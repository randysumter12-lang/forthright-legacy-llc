// @polsia:user-owned — POST /api/bid-drafts/[id>/status. The human-approval
// gate. Auth: requireAuth() + requireSubscription('PROFESSIONAL'). Scoping:
// `where: { id, ownerUserId: user.id }` — IDOR-safe. Delegates to
// `transitionBidDraftStatus` from bid-draft.ts which holds the only
// programmatic surface that can move a draft off 'DRAFT'. The helper itself
// still rejects DRAFT → SUBMITTED (`HumanApprovalRequiredError`) so this
// route handler refuses the user-facing direct-submit even when ops
// profiles the future submission endpoint in.
//
// REVIEW → SUBMITTED is accepted here (the helper permits it), but no UI
// exposes a "Submit" button yet — v1 has no actual submission endpoint,
// so REVIEW → SUBMITTED is currently unreachable from any caller.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  type BidDraftStatusValue,
  HumanApprovalRequiredError,
  transitionBidDraftStatus,
} from '@/lib/business/bid-draft';
import {
  BidDraftStatusTransitionRequest,
  BidDraftStatusTransitionResult,
} from '@/lib/contracts/bid-draft';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { requireSubscription } from '@/lib/require-subscription';

export const dynamic = 'force-dynamic';

const CUID_RE = /^[a-z0-9]{20,32}$/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || !CUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let user: SessionUser;
  try {
    user = await requireAuth(req);
    await requireSubscription(req, 'PROFESSIONAL');
  } catch (res) {
    return res as Response;
  }

  let body: { target?: string };
  try {
    body = (await req.json()) as { target?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = BidDraftStatusTransitionRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }
  const target = parsed.data.target as BidDraftStatusValue;

  // Ownership check first — surface 404 (not 403) so the caller can't
  // distinguish "exists but not yours" from "doesn't exist" (prevents
  // IDOR probing of the contract id space).
  const owned = await prisma.bidDraft.findFirst({
    where: { id, ownerUserId: user.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const result = await transitionBidDraftStatus(id, target);
    const payload = BidDraftStatusTransitionResult.parse(result);
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof HumanApprovalRequiredError) {
      return NextResponse.json({ error: 'human_approval_required' }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (message === 'invalid_status') {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
    }
    return NextResponse.json({ error: 'transition_failed', detail: message }, { status: 500 });
  }
}
