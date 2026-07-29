// @polsia:user-owned — caller-scoped subscription endpoint.
//
// GET  /api/billing/subscription  — returns the caller's CURRENT active
//   subscription as a SubscriptionEnvelope (or active=false). 401 when no
//   session.
//
// POST /api/billing/subscription — body { tier: 'STARTER' | 'PROFESSIONAL' |
//   'ELITE' }. Creates a hosted Stripe Checkout session for the chosen tier
//   through the user-owned runtime helper, persists a Subscription row with
//   status='active' AS SOON AS checkouts returns (the row is reconciled via
//   the Stripe payment-events feed; see below). Returns { url, tier, amount }.
//   The caller redirects to `url`. 401 when no session.
//
// Pricing is ALWAYS server-side: the request body's `tier` only resolves to
// the line item in the catalog (see src/lib/contracts/subscription.ts).
//
// WHY a Subscription row is upserted at CHECKOUT TIME (not after webhook):
//   The Stripe payment-events feed reconciliation is async (cron / verify
//   page), and the bid-draft / capability-statement gates need an immediate
//   `active` row to gate the very first 30 days. We mark the row 'active' on
//   checkout; the events feed reconciles to a real `payment_received` event
//   later and flips status to 'expired' if it never materialized. We
//   additionally tag `stripeCheckoutSessionId` so a future reconcile can
//   match it 1:1.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  CheckoutRequest,
  CheckoutResponse,
  ErrorEnvelope,
  SubscriptionEnvelope,
  TIER_CATALOG,
  type Tier,
} from '@/lib/contracts/subscription';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { deriveProxyBase } from '@/lib/host-proxy';
import {
  createRuntimeCheckoutSession,
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/runtime';

export const dynamic = 'force-dynamic';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function publicOrigin(req: Request): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
}

// --- GET: current subscription for the caller -------------------------------

export async function GET(_req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const row = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      status: 'active',
      periodEnd: { gt: now },
    },
    orderBy: { periodEnd: 'desc' },
  });

  const payload = SubscriptionEnvelope.parse({
    active: Boolean(row),
    subscription: row
      ? {
          id: row.id,
          tier: row.tier,
          status: row.status,
          amountUsd: Number(row.amountUsd),
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
          periodStart: row.periodStart.toISOString(),
          periodEnd: row.periodEnd.toISOString(),
          daysRemaining: Math.max(
            0,
            Math.ceil((row.periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
          ),
        }
      : null,
  });

  return NextResponse.json(payload);
}

// --- POST: create a checkout session for a tier ----------------------------

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(ErrorEnvelope.parse({ error: 'unauthorized' }), { status: 401 });
  }

  const parsed = CheckoutRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(ErrorEnvelope.parse({ error: 'invalid_request' }), { status: 400 });
  }
  const tier: Tier = parsed.data.tier;
  const descriptor = TIER_CATALOG.find((t) => t.tier === tier);
  if (!descriptor) {
    return NextResponse.json(ErrorEnvelope.parse({ error: 'unknown_tier' }), { status: 404 });
  }

  const origin = publicOrigin(req);
  const proxyBase = deriveProxyBase(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '',
  );
  let sessionResult: { id: number; stripeSessionId: string; url: string; totalAmountUsd: number };
  try {
    const result = await createRuntimeCheckoutSession({
      proxyBase,
      name: `Rigel Solutions — ${descriptor.name} (Monthly)`,
      description: descriptor.headline,
      amountUsd: descriptor.amountUsd,
      successUrl: `${origin}/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?status=canceled`,
      customerEmail: session.user.email,
      metadata: {
        rigel_tier: tier,
        rigel_user_id: session.user.id,
      },
    });
    sessionResult = {
      id: result.id,
      stripeSessionId: result.stripeSessionId,
      url: result.url,
      totalAmountUsd: result.totalAmountUsd,
    };
  } catch (err) {
    if (err instanceof StripeBillingNotEnabledError) {
      return NextResponse.json(ErrorEnvelope.parse({ error: 'payments_not_enabled' }), {
        status: 503,
      });
    }
    if (err instanceof StripeBillingOnboardingError) {
      return NextResponse.json(ErrorEnvelope.parse({ error: err.code }), { status: 503 });
    }
    if (err instanceof StripeBillingConfigurationError) {
      return NextResponse.json(ErrorEnvelope.parse({ error: 'stripe_billing_not_configured' }), {
        status: 503,
      });
    }
    return NextResponse.json(ErrorEnvelope.parse({ error: 'checkout_failed' }), { status: 502 });
  }

  // Persist a placeholder Subscription row tied to this checkout session. The
  // bid-draft / capability-statement gates already treat a matching subscribed
  // row as proof of purchase — this lets the user immediately retry their
  // request right after Stripe redirects them back. The events feed later
  // reconciles the `payment_received` event against this row.
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + THIRTY_DAYS_MS);
  try {
    await prisma.subscription.create({
      data: {
        userId: session.user.id,
        tier,
        status: 'active',
        amountUsd: descriptor.amountUsd,
        stripeCheckoutSessionId: sessionResult.stripeSessionId,
        periodStart,
        periodEnd,
      },
    });
  } catch {
    // Unique-conflict on a recycled stripeSessionId is the only expected race;
    // silently fall through (the helper is idempotent on the gateway side).
  }

  const response = CheckoutResponse.parse({
    url: sessionResult.url,
    tier,
    amountUsd: sessionResult.totalAmountUsd,
  });
  return NextResponse.json(response);
}
