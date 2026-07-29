// @polsia:user-owned — GET single SAM.gov opportunity by id. Used by the
// /sam/<id> detail page (renders opportunity context + Generate button).
import 'server-only';
import { NextResponse } from 'next/server';
import { COMPANY_PROFILE } from '@/lib/business/capability-statement';
import { scoreSetAsideQualification } from '@/lib/business/set-aside';
import { SamOpportunityDetail, type SamOpportunityItem } from '@/lib/contracts/sam-opportunity';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CUID_RE = /^[a-z0-9]{20,32}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || !CUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const opp = await prisma.samOpportunity.findUnique({
    where: { id },
    include: {
      capabilityStatement: { select: { id: true } },
      bidDraft: {
        select: {
          id: true,
          status: true,
          revision: true,
          submittedAt: true,
          outcome: true,
          outcomeAt: true,
          outcomeNotes: true,
        },
      },
    },
  });
  if (!opp) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

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
  const bidDecrement =
    opp.bidDecrement == null
      ? null
      : typeof opp.bidDecrement === 'number'
        ? opp.bidDecrement
        : Number(opp.bidDecrement);
  const sourceCandidate = opp.source === 'UNISON' ? 'UNISON' : 'SAM';
  const draftStatus =
    opp.bidDraft?.status === 'DRAFT' ||
    opp.bidDraft?.status === 'REVIEW' ||
    opp.bidDraft?.status === 'SUBMITTED'
      ? (opp.bidDraft.status as 'DRAFT' | 'REVIEW' | 'SUBMITTED')
      : undefined;
  const bidDraftId = opp.bidDraft?.id ?? null;
  const bidDraftRevision = opp.bidDraft?.revision ?? null;
  const bidDraftSubmittedAt = opp.bidDraft?.submittedAt
    ? opp.bidDraft.submittedAt.toISOString()
    : null;
  // Outcome fields are LEFT-JOINed through the same bidDraft select; the
  // column is the `BidOutcome` Prisma enum ('WON' | 'LOST' | 'NO_RESPONSE' |
  // null). Narrow to the contract literal union before projection so a stray
  // shape (corrupted row, future drift) surfaces as parse failure rather
  // than a wrong chip color.
  const bidDraftOutcome = opp.bidDraft?.outcome;
  const outcome =
    bidDraftOutcome === 'WON' || bidDraftOutcome === 'LOST' || bidDraftOutcome === 'NO_RESPONSE'
      ? bidDraftOutcome
      : null;
  const outcomeAt = opp.bidDraft?.outcomeAt ? opp.bidDraft.outcomeAt.toISOString() : null;
  const outcomeNotes = opp.bidDraft?.outcomeNotes ?? null;

  const item: SamOpportunityItem = {
    id: opp.id,
    noticeId: opp.noticeId,
    title: opp.title,
    agency: opp.agency,
    naicsCode: opp.naicsCode,
    dueDate: opp.dueDate ? opp.dueDate.toISOString() : null,
    postedDate: opp.postedDate ? opp.postedDate.toISOString() : null,
    awardValue: Number.isFinite(awardValue) ? awardValue : null,
    setAside: opp.setAside,
    isSetAside: opp.isSetAside,
    category: opp.category as SamOpportunityItem['category'],
    description: opp.description,
    uiLink: opp.uiLink,
    scrapedAt: opp.scrapedAt.toISOString(),
    source: sourceCandidate,
    unisonBuyId: opp.unisonBuyId ?? null,
    unisonRevision: opp.unisonRevision ?? null,
    buyerType: opp.buyerType ?? null,
    leadLagState: opp.leadLagState ?? null,
    activeTargetPrice: Number.isFinite(activeTargetPrice) ? activeTargetPrice : null,
    bidDecrement: Number.isFinite(bidDecrement) ? bidDecrement : null,
    lineItems: Array.isArray(opp.lineItems)
      ? (opp.lineItems as Array<Record<string, unknown>>)
      : null,
    metadata:
      opp.metadata && typeof opp.metadata === 'object' && !Array.isArray(opp.metadata)
        ? (opp.metadata as Record<string, unknown>)
        : null,
    solicitationNumber: opp.solicitationNumber ?? null,
    draftStatus,
  };

  const qualifications = scoreSetAsideQualification(
    {
      noticeId: opp.noticeId,
      title: opp.title,
      agency: opp.agency,
      naicsCode: opp.naicsCode,
      setAside: opp.setAside,
      // placeOfPerformance is not on the persisted SamOpportunity schema yet —
      // pass null so the contract reflects today's data and the HUBZone
      // entry surfaces the POP gate in its reasoning.
      placeOfPerformance: null,
    },
    COMPANY_PROFILE,
  );

  const payload = SamOpportunityDetail.parse({
    item,
    hasCapabilityStatement: opp.capabilityStatement !== null,
    qualifications,
    bidDraftId,
    bidDraftRevision,
    bidDraftSubmittedAt,
    draftStatus,
    outcome,
    outcomeAt,
    outcomeNotes,
  });
  return NextResponse.json(payload);
}
