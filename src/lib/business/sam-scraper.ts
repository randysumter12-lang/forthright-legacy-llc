// @polsia:user-owned — SAM.gov micro-purchase scraper orchestrator. Imports
// the pure helpers (sam-scrape-fetcher.ts) and the Prisma singleton; this
// file owns the database round-trip and the SamScrapeRun audit trail.
// Imported by both jobs/sam-scrape.ts (cron) and POST /api/sam-opportunities/refresh.
// `server-only` is enforced one level up at the route handler and at the
// cron entry — adding it here would break the (jsdom) vitest path that
// composes the documented /sam page (the page itself does not import this
// module).
import { env } from '@/lib/env';
import { prisma } from '../db';
import { fetchSamOpportunities, type NormalizedSamRecord } from './sam-scrape-fetcher';

export interface SamScrapeRunRecord {
  id: string;
  status: 'RUNNING' | 'OK' | 'ERROR' | 'RATE_LIMITED';
  startedAt: Date;
  finishedAt: Date | null;
  fetchedCount: number;
  upsertedCount: number;
  errorMessage: string | null;
  trigger: string;
}

export interface SamScrapeOptions {
  trigger?: 'cron' | 'manual';
  postedFromDays?: number;
  apiKey?: string;
}

export async function runSamScrape(options: SamScrapeOptions = {}): Promise<SamScrapeRunRecord> {
  const trigger = options.trigger ?? 'cron';
  const run = await prisma.samScrapeRun.create({
    data: { status: 'RUNNING', trigger, source: 'SAM' },
  });
  try {
    const result = await fetchSamOpportunities(
      { apiKey: env.SAM_GOV_API_KEY },
      { postedFromDays: options.postedFromDays, apiKey: options.apiKey },
    );
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
      data: {
        status: 'ERROR',
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    return serializeRun(updated);
  }
}

async function upsertRecord(rec: NormalizedSamRecord): Promise<void> {
  await prisma.samOpportunity.upsert({
    where: { noticeId: rec.noticeId },
    create: {
      noticeId: rec.noticeId,
      title: rec.title,
      agency: rec.agency,
      naicsCode: rec.naicsCode,
      dueDate: rec.dueDate,
      postedDate: rec.postedDate,
      awardValue: rec.awardValue == null ? null : rec.awardValue,
      setAside: rec.setAside,
      isSetAside: rec.isSetAside,
      category: rec.category,
      description: rec.description,
      uiLink: rec.uiLink,
      rawJson: rec.rawJson as object,
    },
    update: {
      title: rec.title,
      agency: rec.agency,
      naicsCode: rec.naicsCode,
      dueDate: rec.dueDate,
      postedDate: rec.postedDate,
      awardValue: rec.awardValue == null ? null : rec.awardValue,
      setAside: rec.setAside,
      isSetAside: rec.isSetAside,
      category: rec.category,
      description: rec.description,
      uiLink: rec.uiLink,
      rawJson: rec.rawJson as object,
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
