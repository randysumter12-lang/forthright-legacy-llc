// @vitest-environment node
// Pins the user-owned runtime helper's outbound URL, body shape, and
// error-class mapping (so /api/billing/subscription POST's `instanceof`
// branches keep working without drift from polsia/modules/stripe-billing).

vi.mock('server-only', () => ({}));
// The runtime helper reads POLSIA_API_KEY off process.env directly — it does
// not need the typed env object. Mock the module so the transitive import
// chain through @/lib/stripe-billing/client doesn't trip t3-oss env
// validation, which has no useful answer for this test.
vi.mock('@/lib/env', () => ({
  env: {
    POLSIA_API_BASE_URL: 'https://polsia.com',
    POLSIA_API_KEY: 'company_test_key_aaaaaaaaaaaaa',
    POLSIA_API_TOKEN: undefined,
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRuntimeCheckoutSession,
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/runtime';

const POLSIA_API_KEY = 'company_test_key_aaaaaaaaaaaaa';

function makeJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface CheckoutSessionResponseBody {
  checkout_session: {
    id: number;
    stripe_session_id: string;
    url: string;
    total_amount_usd: number;
    company_receives: number;
    platform_fee: number;
  };
}

describe('createRuntimeCheckoutSession', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let prevKey: string | undefined;
  let prevToken: string | undefined;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    prevKey = process.env.POLSIA_API_KEY;
    prevToken = process.env.POLSIA_API_TOKEN;
    process.env.POLSIA_API_KEY = POLSIA_API_KEY;
    delete process.env.POLSIA_API_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.POLSIA_API_KEY;
    else process.env.POLSIA_API_KEY = prevKey;
    if (prevToken === undefined) delete process.env.POLSIA_API_TOKEN;
    else process.env.POLSIA_API_TOKEN = prevToken;
  });

  it('POSTs to {proxyBase}/api/v2/app-payments/checkout-session with bearer auth', async () => {
    const body: CheckoutSessionResponseBody = {
      checkout_session: {
        id: 42,
        stripe_session_id: 'cs_test_aabbcc',
        url: 'https://checkout.stripe.com/c/cs_test_aabbcc',
        total_amount_usd: 95,
        company_receives: 76,
        platform_fee: 19,
      },
    };
    fetchMock.mockResolvedValue(makeJsonResponse(body, 200));

    const result = await createRuntimeCheckoutSession({
      proxyBase: 'https://polsia.com',
      name: 'Rigel Solutions — Starter (Monthly)',
      description: 'Surface the federal micro-purchase market.',
      amountUsd: 95,
      successUrl:
        'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://rigelcontracts.co/pricing?status=canceled',
      customerEmail: 'buyer@example.com',
      metadata: { rigel_tier: 'STARTER' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl).toBeInstanceOf(URL);
    expect(calledUrl.toString()).toBe('https://polsia.com/api/v2/app-payments/checkout-session');
    expect(calledInit.method).toBe('POST');
    const headers = calledInit.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${POLSIA_API_KEY}`);
    expect(headers.accept).toBe('application/json');
    expect(headers['content-type']).toBe('application/json');

    const parsedBody = JSON.parse(String(calledInit.body));
    expect(parsedBody).toMatchObject({
      name: 'Rigel Solutions — Starter (Monthly)',
      description: 'Surface the federal micro-purchase market.',
      amount: 95,
      success_url:
        'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://rigelcontracts.co/pricing?status=canceled',
      customer_email: 'buyer@example.com',
      metadata: { rigel_tier: 'STARTER' },
    });
    expect(result).toEqual({
      id: 42,
      stripeSessionId: 'cs_test_aabbcc',
      url: 'https://checkout.stripe.com/c/cs_test_aabbcc',
      totalAmountUsd: 95,
      companyReceives: 76,
      platformFee: 19,
    });
  });

  it('does NOT depend on POLSIA_API_BASE_URL — proxyBase is passed by the caller', async () => {
    const body: CheckoutSessionResponseBody = {
      checkout_session: {
        id: 9,
        stripe_session_id: 'cs_test_alt',
        url: 'https://checkout.stripe.com/c/cs_test_alt',
        total_amount_usd: 495,
        company_receives: 396,
        platform_fee: 99,
      },
    };
    fetchMock.mockResolvedValue(makeJsonResponse(body, 200));

    // A non-default proxy base still wins over env (which is unset here).
    delete process.env.POLSIA_API_KEY;
    process.env.POLSIA_API_KEY = POLSIA_API_KEY;
    await createRuntimeCheckoutSession({
      proxyBase: 'https://proxy.example.net',
      amountUsd: 495,
      successUrl:
        'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://rigelcontracts.co/pricing?status=canceled',
    });
    const [calledUrl] = fetchMock.mock.calls[0] as [URL];
    expect(calledUrl.toString()).toBe(
      'https://proxy.example.net/api/v2/app-payments/checkout-session',
    );
  });

  it('throws StripeBillingNotEnabledError on 404 not_enabled', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ error: 'not_enabled' }, 404));
    await expect(
      createRuntimeCheckoutSession({
        proxyBase: 'https://polsia.com',
        amountUsd: 95,
        successUrl:
          'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://rigelcontracts.co/pricing?status=canceled',
      }),
    ).rejects.toBeInstanceOf(StripeBillingNotEnabledError);
  });

  it('throws StripeBillingOnboardingError(stripe_not_configured) on 409 stripe_not_configured', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ error: 'stripe_not_configured' }, 409));
    await expect(
      createRuntimeCheckoutSession({
        proxyBase: 'https://polsia.com',
        amountUsd: 95,
        successUrl:
          'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://rigelcontracts.co/pricing?status=canceled',
      }),
    ).rejects.toBeInstanceOf(StripeBillingOnboardingError);
  });

  it('throws StripeBillingOnboardingError(stripe_not_onboarded) on 409 stripe_not_onboarded', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ error: 'stripe_not_onboarded' }, 409));
    await expect(
      createRuntimeCheckoutSession({
        proxyBase: 'https://polsia.com',
        amountUsd: 95,
        successUrl:
          'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://rigelcontracts.co/pricing?status=canceled',
      }),
    ).rejects.toBeInstanceOf(StripeBillingOnboardingError);
  });

  it('throws StripeBillingConfigurationError when POLSIA_API_KEY is missing', async () => {
    delete process.env.POLSIA_API_KEY;
    delete process.env.POLSIA_API_TOKEN;
    await expect(
      createRuntimeCheckoutSession({
        proxyBase: 'https://polsia.com',
        amountUsd: 95,
        successUrl:
          'https://rigelcontracts.co/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://rigelcontracts.co/pricing?status=canceled',
      }),
    ).rejects.toBeInstanceOf(StripeBillingConfigurationError);
  });
});
