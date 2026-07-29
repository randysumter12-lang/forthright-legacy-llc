// @polsia:user-owned — Capability Statement POST handler. Triggers (or
// re-triggers) the generator against a SAM.gov opportunity id and returns
// the parsed zod envelope. Auth: a signed-in user with an active ELITE
// subscription is required (Elite / Concierge tier). The ops-driven bearer
// still works when SAM_REFRESH_SECRET is configured.
import 'server-only';
import { NextResponse } from 'next/server';
import { generateCapabilityStatement } from '@/lib/business/capability-statement';
import { CapabilityStatementResult } from '@/lib/contracts/capability-statement';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/require-auth';
import { requireSubscription } from '@/lib/require-subscription';

export const dynamic = 'force-dynamic';

const CUID_RE = /^[a-z0-9]{20,32}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || !CUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let opsBypass = false;
  if (env.SAM_REFRESH_SECRET) {
    const header = req.headers.get('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
    if (bearer === env.SAM_REFRESH_SECRET) {
      opsBypass = true;
    } else if (bearer) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  if (!opsBypass) {
    try {
      await requireAuth(req);
      await requireSubscription(req, 'ELITE');
    } catch (res) {
      return res as Response;
    }
  }

  const result = await generateCapabilityStatement(id);
  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const payload = CapabilityStatementResult.parse(result);
  return NextResponse.json(payload);
}
