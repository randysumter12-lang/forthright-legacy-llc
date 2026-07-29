// @polsia:user-owned — manual trigger twin of the auto-draft cron. Bearer-
// gated against SAM_REFRESH_SECRET (same secret as the SAM/Unison refresh
// endpoints; they cluster as ops paths). Mirrors the refresh-handler
// verb-for-verb; the only differences are the orchestrator (runAutoDraft)
// and the AutoDraftTriggerResult envelope.
import 'server-only';
import { NextResponse } from 'next/server';
import { runAutoDraft, serializeAutoDraftForContract } from '@/lib/business/auto-draft';
import { AutoDraftTriggerResult } from '@/lib/contracts/auto-draft';
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

  const run = await runAutoDraft({ trigger: 'manual' });
  const payload = AutoDraftTriggerResult.parse({ run: serializeAutoDraftForContract(run) });

  return NextResponse.json(payload);
}
