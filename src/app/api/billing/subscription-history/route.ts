// @polsia:user-owned — caller-scoped history endpoint.
//
// GET /api/billing/subscription-history — returns { hasAny: boolean }.
// Powers the /dashboard/billing gate: the buyer's page is shown only if they
// HAVE EVER subscribed (active or canceled). A first-time visitor is bounced
// to /pricing instead. 401 when no session.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const count = await prisma.subscription.count({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ hasAny: count > 0 });
}
