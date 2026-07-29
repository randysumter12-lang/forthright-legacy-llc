// @polsia:user-owned — shared dashboard summary aggregation. Single source of
// truth for the qualifying / deadline-soon / open-draft counts displayed in
// the live `/api/dashboard/summary` widget AND rendered into the founder's
// daily morning digest email — the cron and the route handler MUST stay
// numerically identical so the email reflects what the widget showed.
//
// Scoping:
//  - BidDraft is keyed on `ownerUserId` (nullable; the cron passes the
//    founder's `user.id` resolved via `prisma.user.findFirst`, which may be
//    null on a brand-new deploy with no admin row yet → openBidDrafts = 0).
//  - SamOpportunity is global (no per-user scoping); scoring uses the public
//    COMPANY_PROFILE plus the SamOpportunity ranker.
//
// Lazy `@/lib/db` import mirrors the `auto-draft.ts` / `capability-statement.ts`
// precedent so a jsdom vitest can compose the helper without dragging in
// `server-only`.

import type { PrismaClient } from '@prisma/client';
import { COMPANY_PROFILE } from '@/lib/business/capability-statement';
import { scoreSetAsideQualification } from '@/lib/business/set-aside';
import { DashboardSummary } from '@/lib/contracts/dashboard';

const QUALIFYING_THRESHOLD = 0.5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface GetDashboardSummaryOptions {
  now?: Date;
}

export async function getDashboardSummary(
  ownerUserId: string | null,
  options: GetDashboardSummaryOptions = {},
): Promise<DashboardSummary> {
  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  const now = options.now ?? new Date();
  const sevenDaysOut = new Date(now.getTime() + SEVEN_DAYS_MS);

  const rows = await prisma.samOpportunity.findMany({
    select: {
      id: true,
      noticeId: true,
      title: true,
      agency: true,
      naicsCode: true,
      setAside: true,
      dueDate: true,
    },
  });

  let qualifyingThisWeek = 0;
  let deadlineSoon = 0;
  for (const row of rows) {
    const quals = scoreSetAsideQualification(
      {
        noticeId: row.noticeId,
        title: row.title,
        agency: row.agency,
        naicsCode: row.naicsCode,
        setAside: row.setAside,
        // placeOfPerformance is not on the persisted SamOpportunity schema;
        // pass null so the ranker reflects POP-unknown behavior.
        placeOfPerformance: null,
      },
      COMPANY_PROFILE,
      { now },
    );
    const topConfidence = quals[0]?.confidence ?? 0;
    if (topConfidence < QUALIFYING_THRESHOLD) continue;
    qualifyingThisWeek += 1;
    if (row.dueDate !== null && row.dueDate >= now && row.dueDate <= sevenDaysOut) {
      deadlineSoon += 1;
    }
  }

  const openBidDrafts = ownerUserId
    ? await prisma.bidDraft.count({
        where: {
          ownerUserId,
          status: { in: ['DRAFT', 'REVIEW'] },
        },
      })
    : 0;

  return DashboardSummary.parse({
    qualifyingThisWeek,
    deadlineSoon,
    openBidDrafts,
    asOf: now.toISOString(),
  });
}
