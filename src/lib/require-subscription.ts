// @polsia:user-owned — server-side tier-gate helper for protected resources.
//
// Shared by the bid-draft (PROFESSIONAL) and capability-statement (ELITE) route
// handlers. Reads the caller's CURRENT active Subscription row and compares
// its tier against a required tier; throws a 402 Response on insufficient
// tier so callers can return `throw` as the gate (it does NOT redirect — fetch
// callers must get a JSON 402, not a redirect).
//
//   import { requireSubscription } from '@/lib/require-subscription';
//   export async function POST(req: Request) {
//     try {
//       await requireSubscription(req, 'PROFESSIONAL');
//     } catch (res) {
//       return res as Response;
//     }
//     // ...handler body...
//   }
//
// Server-only — calls into the Prisma singleton and reads its own auth session.

import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { TIER_ORDER, type Tier } from '@/lib/contracts/subscription';
import { prisma } from '@/lib/db';

export interface ActiveSubscription {
  id: string;
  userId: string;
  tier: Tier;
  status: 'active' | 'canceled' | 'expired';
  cancelAtPeriodEnd: boolean;
  amountUsd: number;
  periodStart: Date;
  periodEnd: Date;
}

/** Load the caller's current active subscription (or null). */
export async function getCurrentSubscription(): Promise<ActiveSubscription | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const now = new Date();
  const row = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'active',
      periodEnd: { gt: now },
      // cancelAtPeriodEnd gates ACCESS until periodEnd; we still treat it as
      // active here — the UI's billing page surfaces the flag.
    },
    orderBy: { periodEnd: 'desc' },
  });
  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    tier: row.tier as Tier,
    status: row.status as ActiveSubscription['status'],
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    amountUsd: Number(row.amountUsd),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
  };
}

/**
 * Throws a 401 if no session, a 402 `{ error, requiredTier }` if the caller
 * is on a lower tier than `required`, or returns the active subscription.
 * NOTE: the 402 envelope includes `requiredTier` so the client can decide
 * whether to redirect to /pricing or open an upgrade modal.
 */
export async function requireSubscription(
  _req: Request | undefined,
  required: Tier,
): Promise<ActiveSubscription> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    throw Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sub = await getCurrentSubscription();
  if (!sub) {
    throw Response.json(
      { error: 'subscription_required', requiredTier: required },
      { status: 402 },
    );
  }
  if (TIER_ORDER[sub.tier] < TIER_ORDER[required]) {
    throw Response.json(
      { error: 'upgrade_required', requiredTier: required, currentTier: sub.tier },
      { status: 402 },
    );
  }
  return sub;
}
