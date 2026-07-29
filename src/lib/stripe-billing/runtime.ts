// @polsia:user-owned — server-only runtime helper for the Stripe billing proxy.
//
// Mirrors the request shape of polsia/modules/stripe-billing@0.2.0's `client.ts`
// `createCheckoutSession` (same path, same body, same bearer auth, same error
// contract) but takes the proxy base URL from the call site instead of from
// `env.POLSIA_API_BASE_URL`. The platform-managed env var is read-only and
// pinned to the legacy .app address — the route passes the host-derived
// proxy base that proxy.ts stamped onto the request, so the checkout call
// resolves at runtime regardless of which domain the buyer arrives on.
//
// Reuses the framework-owned input/result zod schemas and the 3 typed error
// classes verbatim — the active /api/billing/subscription POST handler's
// `instanceof` mapping on the three error branches keeps working without
// drift.

import 'server-only';
import {
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/client';
import {
  type CheckoutSessionResult,
  type CreateCheckoutSessionInput,
  checkoutSessionResultSchema,
  createCheckoutSessionInputSchema,
} from '@/lib/stripe-billing/schema';

export {
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
};

function readPolsiaApiKey(): string {
  const key = process.env.POLSIA_API_KEY ?? process.env.POLSIA_API_TOKEN;
  if (!key) {
    throw new StripeBillingConfigurationError(
      'POLSIA_API_KEY is missing. Polsia injects it into deployed apps; local dev must set it manually.',
    );
  }
  return key;
}

function buildUrl(proxyBase: string, path: string): URL {
  const base = proxyBase.replace(/\/+$/, '');
  return new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
}

function throwTypedError(status: number, body: unknown): never {
  const detail =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : '';
  if (status === 404 && detail === 'not_enabled') {
    throw new StripeBillingNotEnabledError();
  }
  if (status === 409 && (detail === 'stripe_not_configured' || detail === 'stripe_not_onboarded')) {
    throw new StripeBillingOnboardingError(
      detail as 'stripe_not_configured' | 'stripe_not_onboarded',
    );
  }
  throw new Error(`Polsia billing API request failed: ${status} ${detail}`.trim());
}

async function polsiaJson(
  proxyBase: string,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<unknown> {
  const res = await fetch(buildUrl(proxyBase, path), {
    method: init.method,
    headers: {
      authorization: `Bearer ${readPolsiaApiKey()}`,
      accept: 'application/json',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    cache: 'no-store',
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throwTypedError(res.status, body);
  }
  return body;
}

export type CreateRuntimeCheckoutSessionInput = CreateCheckoutSessionInput & {
  proxyBase: string;
};

/**
 * Runtime Stripe Checkout session (dynamic amount / cart) → hosted checkout URL.
 * Identical contract to `client.ts`'s `createCheckoutSession`, but the proxy
 * base is passed in by the caller (derived from the request host by proxy.ts)
 * so the call site no longer depends on the platform-managed
 * `POLSIA_API_BASE_URL` env var.
 */
export async function createRuntimeCheckoutSession(
  input: CreateRuntimeCheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const { proxyBase, ...rest } = input;
  const parsed = createCheckoutSessionInputSchema.parse(rest);
  const body = await polsiaJson(proxyBase, '/api/v2/app-payments/checkout-session', {
    method: 'POST',
    body: {
      ...(parsed.lineItems
        ? {
            line_items: parsed.lineItems.map((item) => ({
              name: item.name,
              amount: item.amountUsd,
              ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
            })),
          }
        : { amount: parsed.amountUsd }),
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      success_url: parsed.successUrl,
      cancel_url: parsed.cancelUrl,
      ...(parsed.customerEmail !== undefined ? { customer_email: parsed.customerEmail } : {}),
      ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
      ...(parsed.collectShippingAddress !== undefined
        ? { collect_shipping_address: parsed.collectShippingAddress }
        : {}),
      ...(parsed.shippingCountries !== undefined
        ? { shipping_countries: parsed.shippingCountries }
        : {}),
    },
  });
  const session = (body as { checkout_session?: unknown })?.checkout_session;
  const raw = session as {
    id: number;
    stripe_session_id: string;
    url: string;
    total_amount_usd: number;
    company_receives: number;
    platform_fee: number;
  };
  return checkoutSessionResultSchema.parse({
    id: raw.id,
    stripeSessionId: raw.stripe_session_id,
    url: raw.url,
    totalAmountUsd: raw.total_amount_usd,
    companyReceives: raw.company_receives,
    platformFee: raw.platform_fee,
  });
}
