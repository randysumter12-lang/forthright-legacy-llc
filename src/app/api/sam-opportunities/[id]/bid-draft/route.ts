// @polsia:user-owned — Bid Draft POST handler. Triggers (or re-triggers) the
// generator against a SAM.gov opportunity id and returns the parsed zod
// envelope. Auth: a signed-in user with an active PROFESSIONAL (or higher)
// subscription is required. Ops-driven POSTs are still accepted with the
// SAM_REFRESH_SECRET bearer when the secret is configured.
import 'server-only';
import { NextResponse } from 'next/server';
import { generateBidDraft } from '@/lib/business/bid-draft';
import { BidDraftResult } from '@/lib/contracts/bid-draft';
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

  // Ops-driven bearer bypasses the subscription gate so cron-driven refreshes
  // and manual ops POSTs still work; for everyone else, Professional is the gate.
  let opsBypass = false;
  if (env.SAM_REFRESH_SECRET) {
    const header = req.headers.get('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
    if (bearer === env.SAM_REFRESH_SECRET) {
      opsBypass = true;
    } else if (bearer) {
      // A wrong bearer is a 401, not a silent downgrade.
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  if (!opsBypass) {
    try {
      await requireAuth(req);
      await requireSubscription(req, 'PROFESSIONAL');
    } catch (res) {
      return res as Response;
    }
  }

  let body: { force?: boolean } = {};
  try {
    body = (await req.json()) as { force?: boolean };
  } catch {
    // Empty body is fine — defaults to "generate, don't force".
  }

  try {
    const result = await generateBidDraft(id, { force: body.force === true });
    if (!result) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const payload = BidDraftResult.parse(result);
    return NextResponse.json(payload);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown_error';
    if (detail === 'capability_statement_required') {
      // The orchestrator requires the CapabilityStatement row to exist first.
      // Map this to a 409 so the client can route the user to that prior
      // step rather than failing silently.
      return NextResponse.json({ error: 'capability_statement_required' }, { status: 409 });
    }
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
