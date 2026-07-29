// @polsia:user-owned — caller-scoped subscription management endpoint.
//
// POST /api/billing/portal — body { action: 'manage' | 'cancel' }.
//   'manage' is the standard "open billing portal" affordance; today's proxy
//     does not expose a Stripe customer-portal URL factory, so we surface a
//     `manage_url` pointing at /dashboard/billing instead, where the user sees
//     their current plan + cancel button.
//   'cancel' flips the caller's CURRENT active subscription's
//     `cancelAtPeriodEnd` to true and returns the same envelope. Access stays
//     active until `periodEnd`; the portal/UI surfaces that. (Stripe-hosted
//     "immediate cancel" is intentionally not exposed — we don't have a
//     Stripe customer-portal session URL factory in this proxy yet.)
//
// 401 when no session. 404 when the caller has no subscription to manage.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ErrorEnvelope, PortalRequest } from '@/lib/contracts/subscription';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(ErrorEnvelope.parse({ error: 'unauthorized' }), { status: 401 });
  }

  const parsed = PortalRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(ErrorEnvelope.parse({ error: 'invalid_request' }), { status: 400 });
  }

  const now = new Date();
  const current = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      status: 'active',
      periodEnd: { gt: now },
    },
    orderBy: { periodEnd: 'desc' },
  });
  if (!current) {
    return NextResponse.json(ErrorEnvelope.parse({ error: 'no_active_subscription' }), {
      status: 404,
    });
  }

  if (parsed.data.action === 'cancel') {
    // Idempotent: if already flagged, just return the row updatedAt.
    await prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: true, updatedAt: new Date() },
    });
  }

  return NextResponse.json({
    action: parsed.data.action,
    subscriptionId: current.id,
    tier: current.tier,
    cancelAtPeriodEnd: parsed.data.action === 'cancel' ? true : current.cancelAtPeriodEnd,
    // 'manage' redirects to the in-app billing page where the user reviews
    // their plan + has the cancel button. A real Stripe Customer Portal URL
    // is not yet exposed by the payment proxy.
    manageUrl: '/dashboard/billing',
  });
}
