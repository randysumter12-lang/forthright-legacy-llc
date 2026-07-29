// @polsia:user-owned — POST /api/bids/<id>/submit. The user-confirmed
// bid-draft SUBMIT path. Auth gate (requireAuth + requireSubscription
// 'PROFESSIONAL') + ownership scoping (where: { id, ownerUserId: user.id }),
// 404 on miss to preserve IDOR posture. Replays are 409-already_submitted
// that round-trip the EXISTING audit summary so the client renders the row
// without an extra GET. Writes the audit entry + flip-status inside one
// submitBidDraft() transaction (see src/lib/business/bid-draft.ts).
//
// Note: URL namespace is '/api/bids/<id>/submit', NOT
// '/api/bid-drafts/<id>/submit' — the brief is explicit, and the surrounding
// existing handlers stay untouched. Behavior on DRAFT submissions: a raw curl
// can flip any status; the UI gate (BidDraftSubmitButton disabled unless
// status === 'REVIEW') keeps unconfirmed calls from firing by accident.
import 'server-only';
import { NextResponse } from 'next/server';
import { BidSubmitResponseOwnershipError, submitBidDraft } from '@/lib/business/bid-draft';
import { notifyFounderOnBidSubmission } from '@/lib/business/notifications/notify-founder-on-bid-submission';
import {
  BidAudit,
  BidDraftSubmissionEnvelope,
  BidSubmitRequest,
  BidSubmitResult,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = BidSubmitRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Idempotency guard — if a previous successful POST has already stamped this
  // row, return 409 with the EXISTING audit summary so the client can render
  // it without an extra GET round-trip. Reads only the audit columns.
  const existing = await prisma.bidDraft.findFirst({
    where: { id, ownerUserId: user.id },
    select: {
      id: true,
      submittedAt: true,
      submittedByUserId: true,
      submissionAudit: true,
      samOpportunity: {
        select: {
          source: true,
          noticeId: true,
          title: true,
          agency: true,
          naicsCode: true,
          setAside: true,
          isSetAside: true,
          dueDate: true,
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (existing.submittedAt != null) {
    const replay = BidDraftSubmissionEnvelope.parse({
      alreadySubmitted: true,
      submittedAt: existing.submittedAt.toISOString(),
      submittedByUserId: existing.submittedByUserId ?? user.id,
      submissionAudit: BidAudit.parse(existing.submissionAudit ?? []),
    });
    return NextResponse.json(replay, { status: 409 });
  }

  try {
    const result = await submitBidDraft(id, user, parsed.data);
    if (existing.samOpportunity) {
      await notifyFounderOnBidSubmission({
        bidDraftId: result.id,
        ownerUserId: user.id,
        actorId: user.id,
        source: existing.samOpportunity.source === 'UNISON' ? 'UNISON' : 'SAM',
        noticeId: existing.samOpportunity.noticeId,
        title: existing.samOpportunity.title,
        agency: existing.samOpportunity.agency,
        naicsCode: existing.samOpportunity.naicsCode,
        setAside: existing.samOpportunity.setAside,
        isSetAside: existing.samOpportunity.isSetAside,
        dueDate: existing.samOpportunity.dueDate,
        submittedAt: result.submittedAt,
      });
    }
    const payload = BidSubmitResult.parse({
      id: result.id,
      status: result.status,
      submittedAt: result.submittedAt.toISOString(),
      submittedByUserId: result.submittedByUserId,
      submissionAudit: result.submissionAudit,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    if (e instanceof BidSubmitResponseOwnershipError) {
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (e.code === 'already_submitted') {
        return NextResponse.json({ error: 'already_submitted' }, { status: 409 });
      }
      if (e.code === 'invalid_payload') {
        return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
      }
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'submit_failed', detail: message }, { status: 500 });
  }
}
