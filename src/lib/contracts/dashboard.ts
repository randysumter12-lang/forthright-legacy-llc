// @polsia:user-owned — zod contract for the dashboard summary envelope.
// Client-importable: zod only, no server-only imports. Shared between the
// route handler at `src/app/api/dashboard/summary/route.ts` and the
// `QualifyingThisWeekWidget` island.
import { z } from 'zod';

export const DashboardSummary = z.object({
  /** SamOpportunity rows whose top set-aside bucket confidence is ≥ 0.5. */
  qualifyingThisWeek: z.number().int().min(0),
  /** Of those qualifying rows, those whose `dueDate` falls in `[now, now + 7d]`. */
  deadlineSoon: z.number().int().min(0),
  /** BidDraft rows owned by the caller with status in ('DRAFT','REVIEW'). */
  openBidDrafts: z.number().int().min(0),
  /** ISO timestamp the server ran the aggregation at. Lets the island show "as of …". */
  asOf: z.string().datetime(),
});
export type DashboardSummary = z.infer<typeof DashboardSummary>;
