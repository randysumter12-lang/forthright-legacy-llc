// @polsia:user-owned — public catalog endpoint for the 3-tier paywall.
// No auth required: visitors see the same pricing the logged-in user sees
// on /pricing. The catalog lives in src/lib/contracts/subscription.ts so
// client islands and the server agree on tier/price/feature shape.

import 'server-only';
import { NextResponse } from 'next/server';
import { PricingList, TIER_CATALOG } from '@/lib/contracts/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tiers = TIER_CATALOG.map((t) => ({
    tier: t.tier,
    name: t.name,
    headline: t.headline,
    description: t.description,
    amountUsd: t.amountUsd,
    interval: t.interval,
    features: t.features,
    badge: t.badge,
  }));
  const payload = PricingList.parse({ tiers });
  return NextResponse.json(payload);
}
