// @polsia:user-owned — Unison Global OpenBeta scraper orchestrator. Imports
// the pure helpers (unison-scrape-fetcher.ts) and the Prisma singleton; this
// file owns the database round-trip and the SamScrapeRun audit trail that
// records Unison runs alongside SAM.
//
// Schema note: sam-opportunity.prisma's composite index on
// `(unisonBuyId, unisonRevision)` is non-unique (the validator rejected a
// unique index on a populated table). We upsert by `noticeId` (the schema-
// wide `@unique` field) — naming `noticeId = unisonBuyId` makes each buy a
// single mutable row, and the `unisonRevision` column reflects the latest
// revision scraped. New revisions overwrite that row, satisfying the
// "mutates by revision" semantics without a unique composite index.
import { prisma } from '@/lib/db';
import type { SamScrapeRunRecord } from './sam-scraper';
import { fetchUnisonBuys, type NormalizedUnisonBuy } from './unison-scrape-fetcher';

export type { SamScrapeRunRecord };

export interface UnisonScrapeOptions {
  trigger?: 'cron' | 'manual';
  postedFromDays?: number;
}

export type UnisonScrapeTriggerResult = {
  run: SamScrapeRunRecord;
};

export async function runUnisonScrape(
  options: UnisonScrapeOptions = {},
): Promise<SamScrapeRunRecord> {
  const trigger = options.trigger ?? 'cron';
  const run = await prisma.samScrapeRun.create({
    data: { status: 'RUNNING', trigger, source: 'UNISON' },
  });
  try {
    const result = await fetchUnisonBuys({ postedFromDays: options.postedFromDays });
    if (result.status !== 'OK') {
      const updated = await prisma.samScrapeRun.update({
        where: { id: run.id },
        data: {
          status: result.status,
          finishedAt: new Date(),
          fetchedCount: 0,
          errorMessage: result.errorMessage,
        },
      });
      return serializeRun(updated);
    }
    let upserted = 0;
    for (const rec of result.records) {
      await upsertRecord(rec);
      upserted += 1;
    }
    const updated = await prisma.samScrapeRun.update({
      where: { id: run.id },
      data: {
        status: 'OK',
        finishedAt: new Date(),
        fetchedCount: result.records.length,
        upsertedCount: upserted,
      },
    });
    return serializeRun(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const updated = await prisma.samScrapeRun.update({
      where: { id: run.id },
      data: { status: 'ERROR', finishedAt: new Date(), errorMessage: message },
    });
    return serializeRun(updated);
  }
}

async function upsertRecord(rec: NormalizedUnisonBuy): Promise<void> {
  await prisma.samOpportunity.upsert({
    where: { noticeId: rec.noticeId },
    create: {
      noticeId: rec.noticeId,
      title: rec.title,
      agency: rec.agency,
      naicsCode: rec.naicsCode,
      dueDate: rec.dueDate,
      postedDate: rec.postedDate,
      awardValue: rec.awardValue,
      setAside: rec.setAside,
      isSetAside: rec.isSetAside,
      category: rec.category,
      description: rec.description,
      uiLink: rec.uiLink,
      rawJson: rec.rawJson as object,
      source: 'UNISON',
      unisonBuyId: rec.unisonBuyId,
      unisonRevision: rec.unisonRevision,
      buyerType: rec.buyerType,
      leadLagState: rec.leadLagState,
      activeTargetPrice: rec.activeTargetPrice,
      bidDecrement: rec.bidDecrement,
      lineItems: rec.lineItems as object,
      solicitationNumber: rec.noticeId,
    },
    update: {
      title: rec.title,
      agency: rec.agency,
      naicsCode: rec.naicsCode,
      dueDate: rec.dueDate,
      postedDate: rec.postedDate,
      awardValue: rec.awardValue,
      setAside: rec.setAside,
      isSetAside: rec.isSetAside,
      category: rec.category,
      description: rec.description,
      uiLink: rec.uiLink,
      rawJson: rec.rawJson as object,
      source: 'UNISON',
      unisonBuyId: rec.unisonBuyId,
      // Each scrape overwrites with the latest revision (mutates-by-revision).
      unisonRevision: rec.unisonRevision,
      buyerType: rec.buyerType,
      leadLagState: rec.leadLagState,
      activeTargetPrice: rec.activeTargetPrice,
      bidDecrement: rec.bidDecrement,
      lineItems: rec.lineItems as object,
      solicitationNumber: rec.noticeId,
    },
  });
}

function serializeRun(row: {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  fetchedCount: number;
  upsertedCount: number;
  errorMessage: string | null;
  trigger: string;
}): SamScrapeRunRecord {
  const allowedStatuses = ['RUNNING', 'OK', 'ERROR', 'RATE_LIMITED'] as const;
  const status = (allowedStatuses.find((s) => s === row.status) ?? 'ERROR') as
    | 'RUNNING'
    | 'OK'
    | 'ERROR'
    | 'RATE_LIMITED';
  return {
    id: row.id,
    status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    fetchedCount: row.fetchedCount,
    upsertedCount: row.upsertedCount,
    errorMessage: row.errorMessage,
    trigger: row.trigger,
  };
}
