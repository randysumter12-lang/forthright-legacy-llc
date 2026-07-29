// @polsia:user-owned — manual trigger twin of the Unison cron. Bearer-gated
// against SAM_REFRESH_SECRET (re-uses the same ops secret). Mirrors
// src/app/api/sam-opportunities/refresh/route.ts verb-for-verb; the only
// differences are the orchestrator (runUnisonScrape) and the
// `source: 'UNISON'` stamp on the returned envelope.
import 'server-only';
import { NextResponse } from 'next/server';
import { runUnisonScrape } from '@/lib/business/unison-scraper';
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

  const run = await runUnisonScrape({ trigger: 'manual' });

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
      source: 'UNISON',
    },
  });

  return NextResponse.json(payload);
}
