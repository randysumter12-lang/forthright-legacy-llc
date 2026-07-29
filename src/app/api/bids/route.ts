// @polsia:user-owned — list endpoint for Bid Drafts in the SUBMITTED state
// owned by the caller. Drives the /submitted-bids table. Mirrors the
// /api/dashboard/summary posture: requireAuth only (no subscription gate).
// Scoping: `where: { ownerUserId: user.id }`. The submission audit body
// is not shipped — only the count of entries is sent to the client.
import 'server-only';
import { NextResponse } from 'next/server';
import { SubmittedBids, SubmittedBidsQuery } from '@/lib/contracts/submitted-bids';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  // Brief's URL parameter is lowercase ('?status=submitted'); normalize to
  // upper before validating against the BID_DRAFT_STATUS enum so both
  // spellings parse, while a bogus value (e.g. 'banana') still 400s.
  const rawStatus = url.searchParams.get('status');
  const parsedQuery = SubmittedBidsQuery.safeParse({
    status: rawStatus ? rawStatus.toUpperCase() : undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  // The /submitted-bids surface is SUBMITTED-only; the query envelope is
  // structured so future filters (e.g. by DRAFT) can share this seam.
  // Coerced values outside SUBMITTED still resolve to the SUBMITTED list
  // for now — the caller is the page, and any other status is a no-op.
  void parsedQuery.data;

  const rows = await prisma.bidDraft.findMany({
    where: {
      ownerUserId: user.id,
      status: 'SUBMITTED',
    },
    orderBy: [{ submittedAt: 'desc' }],
    include: {
      samOpportunity: true,
    },
  });

  const items = rows.map((row) => {
    // Same invariant as submittedAt: a SUBMITTED row passed through the
    // submit transaction so both columns are non-null in practice. Empty
    // string fallback surfaces a parse failure to the zod bottom-of-route
    // if the invariant is ever broken.
    const submittedAt = row.submittedAt?.toISOString() ?? '';
    const submittedByUserId = row.submittedByUserId ?? '';
    const submissionAuditCount = Array.isArray(row.submissionAudit)
      ? row.submissionAudit.length
      : 0;
    const source = (row.samOpportunity?.source === 'UNISON' ? 'UNISON' : 'SAM') as 'SAM' | 'UNISON';
    // Outcome columns are nullable for legacy SUBMITTED rows that pre-date
    // the outcome endpoint. Narrow the BidOutcome Prisma enum to the
    // contract literal union before projection so a malformed value
    // surfaces as a zod parse failure rather than a wrong chip color.
    const rawOutcome = row.outcome;
    const outcome =
      rawOutcome === 'WON' || rawOutcome === 'LOST' || rawOutcome === 'NO_RESPONSE'
        ? rawOutcome
        : null;
    const outcomeAt = row.outcomeAt ? row.outcomeAt.toISOString() : null;
    const outcomeNotes = row.outcomeNotes ?? null;
    return {
      id: row.id,
      submittedAt,
      submittedByUserId,
      submissionAuditCount,
      source,
      outcome,
      outcomeAt,
      outcomeNotes,
      opportunity: {
        id: row.samOpportunity?.id ?? '',
        noticeId: row.samOpportunity?.noticeId ?? '',
        title: row.samOpportunity?.title ?? '',
        agency: row.samOpportunity?.agency ?? '',
        setAside: row.samOpportunity?.setAside ?? null,
        isSetAside: row.samOpportunity?.isSetAside ?? false,
        dueDate: row.samOpportunity?.dueDate ? row.samOpportunity.dueDate.toISOString() : null,
      },
    };
  });

  const payload = SubmittedBids.parse({ items });
  return NextResponse.json(payload, { status: 200 });
}
