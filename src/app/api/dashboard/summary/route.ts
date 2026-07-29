// @polsia:user-owned — GET dashboard summary (qualifying / deadline-soon /
// open-draft counts). Auth: requireAuth(). The aggregation logic lives in
// `getDashboardSummary` (src/lib/business/dashboard-summary.ts) so the cron
// digest and the live widget share one numeric source.
import 'server-only';
import { NextResponse } from 'next/server';
import { getDashboardSummary } from '@/lib/business/dashboard-summary';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const payload = await getDashboardSummary(user.id, { now: new Date() });
  return NextResponse.json(payload, { status: 200 });
}
