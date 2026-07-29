// @polsia:user-owned — manual trigger for the SAME runSamScrape() the cron
// invokes. Gated on SAM_REFRESH_SECRET (Authorization: Bearer <value>).
// Hand-written code lives in src/lib/business/sam-scraper.ts; route handlers
// own the HTTP boundary and never reach into the DB directly.
import 'server-only';
import { NextResponse } from 'next/server';
import { runSamScrape } from '@/lib/business/sam-scraper';
import { SamOpportunityTriggerResult } from '@/lib/contracts/sam-opportunity';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!env.SAM_REFRESH_SECRET) {
    return NextResponse.json({ error: 'manual trigger disabled' }, { status: 503 });
  }

  const header = req.headers.get('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (bearer !== env.SAM_REFRESH_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Awaited synchronously so the caller (UI button / ops curl) sees a
  // completed run record instead of a 202 that forces polling. With a 1-day
  // postedFrom and SAM.gov's normal response, the scrape completes in a few
  // seconds.
  const run = await runSamScrape({ trigger: 'manual' });

  const payload = SamOpportunityTriggerResult.parse({
    run: {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      fetchedCount: run.fetchedCount,
      upsertedCount: run.upsertedCount,
      errorMessage: run.errorMessage,
      trigger: run.trigger,
    },
  });

  return NextResponse.json(payload);
}
