// @polsia:user-owned — auto-draft orchestrator. Walks SamOpportunity rows
// that were upserted in the most recent successful scrape (window: scope
// by the source scrape run's postedDate OR scrape-run timestamps), qualifies
// each via qualifyForOpportunity, and produces or refreshes the corresponding
// BidDraft (status='DRAFT' only). Emits one AutoDraftRun audit row with
// per-skip reason counts.
//
// Orchestration rules (frozen in this file — never bypassed by callers):
//  - source === 'UNISON' → SKIPPED: 'unison_band_semantics_pending'
//  - not qualifies       → SKIPPED: 'qualify_fail'
//  - missing CapabilityStatement OR not in $3.5K–$10K band → SKIPPED
//  - existing BidDraft fresher than 24h → SKIPPED: 'already_fresh'
//  - otherwise: ensure CapabilityStatement exists, then generateBidDraft.
//
// Owner resolution: first User with an active subscription. Single-operator
// tenant today; multi-tenant scoping is wired by stamping ownerUserId on
// upsert for future multi-tenant correctness.
//
// Hard constraint: this file NEVER writes status === 'SUBMITTED'. Only the
// route handler at /api/bid-drafts/[id]/status (via transitionBidDraftStatus)
// can flip DRAFT → REVIEW → SUBMITTED. The orchestrator is the only writer
// of status === 'DRAFT'.
import type { PrismaClient } from '@prisma/client';
import { COMPANY_PROFILE } from '@/lib/business/capability-statement';
import { qualifyForOpportunity } from '@/lib/business/qualify';
import { AWARD_CEILING, AWARD_FLOOR } from '@/lib/business/sam-scrape-fetcher';
import { AUTO_DRAFT_RUN_STATUS, type AutoDraftRun } from '@/lib/contracts/auto-draft';

export interface RunAutoDraftOptions {
  trigger?: 'cron' | 'manual';
  postedWindowDays?: number;
}

export interface AutoDraftRunRecord {
  id: string;
  status: (typeof AUTO_DRAFT_RUN_STATUS)[number];
  startedAt: Date;
  finishedAt: Date | null;
  trigger: string;
  considered: number;
  qualified: number;
  drafted: number;
  skipped: number;
  reasonCounts: Record<string, number>;
  errorMessage: string | null;
}

export async function runAutoDraft(options: RunAutoDraftOptions = {}): Promise<AutoDraftRunRecord> {
  const trigger = options.trigger ?? 'cron';
  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  const runRow = await prisma.autoDraftRun.create({
    data: { status: 'RUNNING', trigger },
  });

  try {
    return await orchestrate(prisma, runRow.id, trigger, options);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const updated = await prisma.autoDraftRun.update({
      where: { id: runRow.id },
      data: { status: 'ERROR', finishedAt: new Date(), errorMessage: message },
    });
    return serializeRun(updated);
  }
}

type PrismaScoped = PrismaClient;

async function orchestrate(
  prisma: PrismaScoped,
  runId: string,
  trigger: string,
  options: RunAutoDraftOptions,
): Promise<AutoDraftRunRecord> {
  const ownerUserId = await resolveOwnerUserId(prisma);

  const windowDays = options.postedWindowDays ?? 1;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const opps = await prisma.samOpportunity.findMany({
    where: {
      source: 'SAM',
      postedDate: { gte: cutoff },
    },
    orderBy: { postedDate: 'desc' },
    include: {
      capabilityStatement: { select: { id: true } },
      bidDraft: { select: { id: true, updatedAt: true, status: true } },
    },
  });

  const reasonCounts: Record<string, number> = {};
  let considered = 0;
  let qualified = 0;
  let drafted = 0;
  let skipped = 0;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  for (const opp of opps) {
    considered += 1;

    const inBand =
      opp.awardValue != null &&
      Number(opp.awardValue) >= AWARD_FLOOR &&
      Number(opp.awardValue) <= AWARD_CEILING;
    if (!inBand) {
      skipped += 1;
      bumpReason(reasonCounts, 'award_value_out_of_band');
      continue;
    }

    const qualification = qualifyForOpportunity(
      {
        noticeId: opp.noticeId,
        title: opp.title,
        agency: opp.agency,
        naicsCode: opp.naicsCode,
        setAside: opp.setAside,
        source: 'SAM',
      },
      COMPANY_PROFILE,
    );
    if (!qualification.qualifies) {
      skipped += 1;
      bumpReason(reasonCounts, 'qualify_fail');
      continue;
    }
    qualified += 1;

    // band gate passed + qualifies → ensure CapabilityStatement exists, then
    // (re)generate BidDraft. Existing capability statement is reused.
    try {
      if (!opp.capabilityStatement) {
        // Lazy import to keep the orchestrator jsdom-loadable without pulling
        // @/lib/db into the test environment, and to mirror the precedent in
        // bid-draft.ts:449 for the lazy @/lib/db pattern.
        const { generateCapabilityStatement } = await import('@/lib/business/capability-statement');
        const generated = await generateCapabilityStatement(opp.id);
        if (!generated) {
          skipped += 1;
          bumpReason(reasonCounts, 'no_opportunity');
          continue;
        }
      }

      // Skip fresh bid drafts (last updated < 24h ago)
      const draftAgeMs = opp.bidDraft?.updatedAt
        ? Date.now() - opp.bidDraft.updatedAt.getTime()
        : Number.POSITIVE_INFINITY;
      if (opp.bidDraft && opp.bidDraft.status === 'DRAFT' && draftAgeMs < twentyFourHoursMs) {
        skipped += 1;
        bumpReason(reasonCounts, 'already_fresh');
        continue;
      }

      const { generateBidDraft } = await import('@/lib/business/bid-draft');
      await generateBidDraft(opp.id, { force: false });

      // Stamp ownerUserId on the newly upserted BidDraft row (if known) so
      // the per-user /api/bid-drafts list endpoint returns the right slice.
      if (ownerUserId) {
        await prisma.bidDraft.update({
          where: { samOpportunityId: opp.id },
          data: { ownerUserId },
        });
      }

      drafted += 1;
    } catch (e) {
      // One bad seed in a batch should not poison the whole run; record the
      // reason and continue. Auto-draft is best-effort nightly.
      const message = e instanceof Error ? e.message : String(e);
      skipped += 1;
      reasonCounts[`generation_error:${message.slice(0, 40)}`] =
        (reasonCounts[`generation_error:${message.slice(0, 40)}`] ?? 0) + 1;
    }
  }

  const status: 'OK' = 'OK';
  const finishedAt = new Date();
  const updatedRow = await prisma.autoDraftRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt,
      considered,
      qualified,
      drafted,
      skipped,
      reasonCounts: reasonCounts as object,
    },
  });
  return serializeRun({ ...updatedRow, trigger });
}

async function resolveOwnerUserId(prisma: PrismaScoped): Promise<string | null> {
  // Single-tenant today: pick the first user with an active subscription —
  // the founder-operator Randy. Multi-tenant scoping will read this column
  // off the BidDraft row and per-user lists will filter accordingly.
  const subscription = await prisma.subscription.findFirst({
    where: { status: 'active' },
    orderBy: { periodEnd: 'desc' },
    select: { userId: true },
  });
  return subscription?.userId ?? null;
}

function bumpReason(counts: Record<string, number>, reason: string): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

function serializeRun(row: {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  trigger: string;
  considered: number;
  qualified: number;
  drafted: number;
  skipped: number;
  reasonCounts: unknown;
  errorMessage: string | null;
}): AutoDraftRunRecord {
  const allowedStatuses = AUTO_DRAFT_RUN_STATUS as readonly string[];
  const status = (allowedStatuses.find((s) => s === row.status) ?? 'ERROR') as
    | 'RUNNING'
    | 'OK'
    | 'ERROR'
    | 'SKIPPED';
  const reasonCounts =
    row.reasonCounts && typeof row.reasonCounts === 'object' && !Array.isArray(row.reasonCounts)
      ? (row.reasonCounts as Record<string, number>)
      : {};
  return {
    id: row.id,
    status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    trigger: row.trigger ?? 'cron',
    considered: row.considered,
    qualified: row.qualified,
    drafted: row.drafted,
    skipped: row.skipped,
    reasonCounts,
    errorMessage: row.errorMessage,
  };
}

export function serializeAutoDraftForContract(run: AutoDraftRunRecord): AutoDraftRun {
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    trigger: run.trigger,
    considered: run.considered,
    qualified: run.qualified,
    drafted: run.drafted,
    skipped: run.skipped,
    reasonCounts: run.reasonCounts,
    errorMessage: run.errorMessage,
  };
}
