// @polsia:user-owned — GET single Bid Draft by its own draft id. Re-hydrates
// the typed envelope from the persisted row. Mirrors the CapabilityStatement
// / SamOpportunity GET handler posture (CUID validation + lazy prisma). The
// POST handler at /api/sam-opportunities/<id>/bid-draft is the generator path;
// this one is the read-back path.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  BidAudit,
  type BidComplianceMatrix,
  type BidCover,
  BidDraftResult,
  type BidPastPerformance,
  type BidPricingSummary,
  type BidStaffing,
  type BidTechnicalApproach,
  OutcomeAudit,
} from '@/lib/contracts/bid-draft';

export const dynamic = 'force-dynamic';

const CUID_RE = /^[a-z0-9]{20,32}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || !CUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };
  const row = await prisma.bidDraft.findUnique({
    where: { id },
    include: { samOpportunity: { select: { source: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Re-hydrate the typed sections from the persisted JSON via the contract —
  // guards against silent drift if the schema changes between writes.
  const cover = row.cover as unknown as BidCover;
  const technicalApproach = row.technicalApproach as unknown as BidTechnicalApproach;
  const staffing = row.staffing as unknown as BidStaffing;
  const pricingSummary = row.pricingSummary as unknown as BidPricingSummary;
  const pastPerformance = row.pastPerformance as unknown as BidPastPerformance;
  const complianceMatrix = row.complianceMatrix as unknown as BidComplianceMatrix;

  // Re-parse the submissionAudit JSONB through the contract — `null` (pre-
  // submission legacy rows) round-trips as `undefined` so the audit-row island
  // chooses to render only when the field is actually populated.
  const submissionAudit =
    row.submissionAudit == null ? undefined : BidAudit.parse(row.submissionAudit);

  // Same posture for the outcome audit — only round-trip when populated so
  // never-outcome SUBMITTED rows keep the field undefined and the chip
  // island renders nothing.
  const outcomeAudit = row.outcomeAudit == null ? undefined : OutcomeAudit.parse(row.outcomeAudit);

  // Narrow the Prisma enum to the contract literal before projection so a
  // drift surfaces as a zod parse failure (the page surfaces the chain),
  // rather than passing a bare string that could mis-render a chip color.
  const rawOutcome = row.outcome;
  const outcome =
    rawOutcome === 'WON' || rawOutcome === 'LOST' || rawOutcome === 'NO_RESPONSE'
      ? rawOutcome
      : null;

  const envelope = BidDraftResult.parse({
    samOpportunityId: row.samOpportunityId,
    source: row.samOpportunity?.source === 'UNISON' ? 'UNISON' : 'SAM',
    draft: {
      id: row.id,
      samOpportunityId: row.samOpportunityId,
      status: row.status,
      revision: row.revision,
      generatedAt: row.generatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sections: {
        cover,
        technicalApproach,
        staffing,
        pricingSummary,
        pastPerformance,
        complianceMatrix,
      },
      markdown: row.markdown,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      submittedByUserId: row.submittedByUserId ?? null,
      submissionAudit,
      outcome,
      outcomeAt: row.outcomeAt ? row.outcomeAt.toISOString() : null,
      outcomeNotes: row.outcomeNotes ?? null,
      outcomeAudit,
    },
  });

  return NextResponse.json(envelope);
}
