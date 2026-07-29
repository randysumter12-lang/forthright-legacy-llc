// @polsia:user-owned — list endpoint for Bid Drafts owned by the caller.
// Auth: requireAuth() + requireSubscription('PROFESSIONAL'). Scoping:
// `where: { ownerUserId: user.id }`. LEFT JOIN SamOpportunity so the
// dashboard "Today's Bid Queue" can render title / dueDate / awardValue /
// source with a single round-trip. Status filter is a CSV on the
// BID_DRAFT_STATUS enum.
import 'server-only';
import { NextResponse } from 'next/server';
import { LastAutoDraftRun } from '@/lib/contracts/auto-draft';
import { BID_DRAFT_STATUS, BidDraftList, BidDraftListQuery } from '@/lib/contracts/bid-draft';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { requireSubscription } from '@/lib/require-subscription';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  let sub: { id: string };
  try {
    user = await requireAuth(req);
    sub = await requireSubscription(req, 'PROFESSIONAL');
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const parsedQuery = BidDraftListQuery.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const { status, limit } = parsedQuery.data;

  const requestedStatuses = parseStatusFilter(status);
  const items = await prisma.bidDraft.findMany({
    where: {
      ownerUserId: user.id,
      status: { in: requestedStatuses },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: limit,
    include: {
      samOpportunity: true,
    },
  });

  const listItems = items.map((item) => {
    const opp = item.samOpportunity;
    const awardValue =
      opp.awardValue == null
        ? null
        : typeof opp.awardValue === 'number'
          ? opp.awardValue
          : Number(opp.awardValue);
    const activeTargetPrice =
      opp.activeTargetPrice == null
        ? null
        : typeof opp.activeTargetPrice === 'number'
          ? opp.activeTargetPrice
          : Number(opp.activeTargetPrice);
    return {
      id: item.id,
      samOpportunityId: item.samOpportunityId,
      status: item.status as 'DRAFT' | 'REVIEW' | 'SUBMITTED',
      revision: item.revision,
      generatedAt: item.generatedAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      opportunity: {
        id: opp.id,
        noticeId: opp.noticeId,
        title: opp.title,
        agency: opp.agency,
        dueDate: opp.dueDate ? opp.dueDate.toISOString() : null,
        postedDate: opp.postedDate ? opp.postedDate.toISOString() : null,
        awardValue: Number.isFinite(awardValue) ? awardValue : null,
        setAside: opp.setAside,
        isSetAside: opp.isSetAside,
        category: opp.category as 'IT_SERVICES' | 'CMMC' | 'CONSULTING' | 'OTHER',
        source: opp.source === 'UNISON' ? ('UNISON' as const) : ('SAM' as const),
        activeTargetPrice: Number.isFinite(activeTargetPrice) ? activeTargetPrice : null,
      },
    };
  });

  const lastRunRow = await prisma.autoDraftRun.findFirst({
    orderBy: { startedAt: 'desc' },
  });
  const lastAutoDraftRun = lastRunRow
    ? LastAutoDraftRun.parse({
        id: lastRunRow.id,
        status: lastRunRow.status,
        startedAt: lastRunRow.startedAt.toISOString(),
        finishedAt: lastRunRow.finishedAt?.toISOString() ?? null,
        trigger: lastRunRow.trigger,
        considered: lastRunRow.considered,
        qualified: lastRunRow.qualified,
        drafted: lastRunRow.drafted,
        skipped: lastRunRow.skipped,
        reasonCounts:
          lastRunRow.reasonCounts &&
          typeof lastRunRow.reasonCounts === 'object' &&
          !Array.isArray(lastRunRow.reasonCounts)
            ? (lastRunRow.reasonCounts as Record<string, number>)
            : undefined,
        errorMessage: lastRunRow.errorMessage,
      })
    : undefined;

  // Mark sub as referenced so the gate is consumed and the variable isn't
  // flagged unused — keeps the use of requireSubscription in the handler
  // explicit at the lint layer.
  void sub;

  const payload = BidDraftList.parse({
    items: listItems,
    lastAutoDraftRun,
  });
  return NextResponse.json(payload);
}

function parseStatusFilter(raw: string | undefined): Array<(typeof BID_DRAFT_STATUS)[number]> {
  if (!raw) return ['DRAFT', 'REVIEW'];
  const tokens = raw
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0);
  const valid = BID_DRAFT_STATUS as readonly string[];
  const filtered = tokens.filter((token) => valid.includes(token));
  return (filtered.length === 0 ? BID_DRAFT_STATUS : filtered) as Array<
    (typeof BID_DRAFT_STATUS)[number]
  >;
}
