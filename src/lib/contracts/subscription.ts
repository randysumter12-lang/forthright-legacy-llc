// @polsia:user-owned — shared zod contract + tier catalog for the 3-tier
// subscription paywall. Client-importable: zod + plain data only, no
// server-only imports. Mirrored by the /api/billing/* route handlers and the
// /api/pricing public catalog.
//
// IMPORTANT: subscription billing is implemented as ONE-TIME monthly Stripe
// checkout sessions, NOT as recurring Stripe subscriptions. The stripe-billing
// module's AGENT.md states runtime recurring-plan creation from app code is
// not yet supported; each tier maps to a fixed monthly price paid up-front,
// which dates a 30-day access window. Renewal is another checkout.

import { z } from 'zod';

// Three ordered tiers. Order is meaningful: 'PROFESSIONAL' subsumes
// 'STARTER'; 'ELITE' subsumes both. The tier gate in
// require-subscription.ts uses TIER_ORDER to compare current vs required.
export const TIER = ['STARTER', 'PROFESSIONAL', 'ELITE'] as const;
export type Tier = (typeof TIER)[number];

export const TIER_ORDER: Record<Tier, number> = {
  STARTER: 0,
  PROFESSIONAL: 1,
  ELITE: 2,
};

// Subscription lifecycle status as persisted by the agent; the framework does
// not ship one. 'past_due' / 'incomplete' / 'unpaid' are not generated because
// the system runs on up-front paid monthly checkouts, not recurring charges.
export const SUBSCRIPTION_STATUS = ['active', 'canceled', 'expired'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export interface TierDescriptor {
  tier: Tier;
  /** Stripe line-item name shown at checkout. */
  name: string;
  /** Human-readable headline. */
  headline: string;
  /** One-paragraph marketing copy. */
  description: string;
  /** Whole-dollar USD price (charged once per 30-day window). */
  amountUsd: number;
  /** Per-feature bullets. */
  features: string[];
  /** Stripe billing interval shown next to the price (cosmetic). */
  interval: string;
  /** Marketing badge on the card; '' disables. */
  badge: string;
}

// Single source of truth for the catalog — referenced by /api/pricing, the
// pricing page island, and the checkout handler. The numbers come from the
// brief; the descriptions are app-owned marketing copy.
export const TIER_CATALOG: readonly TierDescriptor[] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    headline: 'Surface the federal micro-purchase market.',
    description:
      'Continuous SAM.gov monitoring for IT services, CMMC pre-reviews, and consulting opportunities that match your capabilities. See every daily drop — submission-ready candidates only. Capability statements on demand, one bid draft at a time.',
    amountUsd: 95,
    interval: 'per month',
    badge: '',
    features: [
      'Daily SAM.gov + Unison Global micro-purchase feed ($3.5K–$10K)',
      'Set-aside + category filters',
      'Opportunity detail view + Capability Statement generator',
      'Manual bid drafting for one opportunity per month',
      'Email digest of new opportunities',
    ],
  },
  {
    tier: 'PROFESSIONAL',
    name: 'Professional',
    headline: 'Full autonomy — identify, draft, package, deliver.',
    description:
      "Everything in Starter, plus AI-generated bid drafts on every qualified opportunity, set-aside preferential positioning, and the platform's autonomous refresh loop. Hand off the drafting; review only the polished output. Built for operators running volume.",
    amountUsd: 495,
    interval: 'per month',
    badge: 'Most selected',
    features: [
      'Everything in Starter',
      'Unlimited AI-generated bid drafts',
      'Set-aside positioning (Minority-Owned + Active Duty)',
      'Daily autonomous SAM.gov + Unison Global refresh job',
      'Polished proposal formatting — ready for human review',
      'Status tracking across the bid pipeline',
    ],
  },
  {
    tier: 'ELITE',
    name: 'Elite / Concierge',
    headline: 'Concierge delivery — your proposal team on standby.',
    description:
      "Everything in Professional, plus a dedicated Concierge channel for submission-day escalation, white-glove capability statement crafting, and same-day turnaround on high-value micro-purchase windows. Bid windows don't wait; neither do we.",
    amountUsd: 1500,
    interval: 'per month',
    badge: 'Concierge',
    features: [
      'Everything in Professional',
      'Dedicated Concierge escalation channel',
      'Hand-crafted capability statements (CMMC pre-reviews included)',
      'Same-day turnaround on bid windows < 48h',
      'Submission-day support + post-award handoff',
      'Quarterly federal-market posture review',
    ],
  },
];

// --- zod schemas (mirror the catalog above) ----------------------------

export const TierEnum = z.enum(TIER);
export const SubscriptionStatusEnum = z.enum(SUBSCRIPTION_STATUS);

// Public GET /api/pricing response — static catalog, no auth required.
export const PricingList = z.object({
  tiers: z.array(
    z.object({
      tier: TierEnum,
      name: z.string(),
      headline: z.string(),
      description: z.string(),
      amountUsd: z.number().int().positive(),
      interval: z.string(),
      features: z.array(z.string()),
      badge: z.string(),
    }),
  ),
});
export type PricingListTiers = z.infer<typeof PricingList>['tiers'];

// Authenticated GET /api/billing/subscription response — the user's CURRENT
// active subscription, or null if none active right now.
export const SubscriptionEnvelope = z.object({
  active: z.boolean(),
  subscription: z
    .object({
      id: z.string(),
      tier: TierEnum,
      status: SubscriptionStatusEnum,
      amountUsd: z.number(),
      cancelAtPeriodEnd: z.boolean(),
      periodStart: z.string(),
      periodEnd: z.string(),
      daysRemaining: z.number().int().min(0),
    })
    .nullable(),
});
export type SubscriptionEnvelope = z.infer<typeof SubscriptionEnvelope>;

// POST /api/billing/subscription body — the tier the caller wants to buy.
export const CheckoutRequest = z.object({
  tier: TierEnum,
});

// POST /api/billing/subscription response — hosted Stripe Checkout URL.
export const CheckoutResponse = z.object({
  url: z.string().url(),
  tier: TierEnum,
  amountUsd: z.number().int().positive(),
});

// POST /api/billing/portal body — the action the caller wants.
export const PortalRequest = z.object({
  action: z.enum(['manage', 'cancel']),
});

// Generic error envelope shared by billing endpoints.
export const ErrorEnvelope = z.object({
  error: z.string(),
  requiredTier: TierEnum.optional(),
});
