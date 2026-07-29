// @polsia:user-owned — POST /api/bids/<id>/outcome. First outcome wins:
// stamps WON | LOST | NO_RESPONSE (+ optional notes) onto a SUBMITTED
// BidDraft owned by the caller. Mirrors the posture set by the sibling
// POST /api/bids/<id>/submit route — same auth/no-auth seam, same
// PROFESSIONAL tier gate, same IDOR 404 posture, same CUID validation,
// same 409-already-replay shape (extended to surface the outcome fields).
// Behavior on a raw curl that targets a never-submitted draft: 409
// `not_submitted`. The UI gate (BidOutcomeButtons hidden unless
// draftStatus === 'SUBMITTED') keeps stray calls from succeeding on
// accident. Audit + outcome columns land in a single prisma.$transaction.
import 'server-only';
import { NextResponse } from 'next/server';
import { BidOutcomeResponseError, recordBidOutcome } from '@/lib/business/bid-draft';
import { notifyFounderOnBidOutcome } from '@/lib/business/notifications/notify-founder-on-bid-outcome';
import {
  BidOutcomeReplayEnvelope,
  BidOutcomeRequest,
  BidOutcomeResult,
  OutcomeAudit,
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
  const parsed = BidOutcomeRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Idempotency guard — if a previous successful POST has already stamped
  // this row, or the row isn't SUBMITTED, return 409 with the EXISTING
  // outcome summary (so the client renders the chip without an extra GET).
  const existing = await prisma.bidDraft.findFirst({
    where: { id, ownerUserId: user.id },
    select: {
      id: true,
      status: true,
      outcome: true,
      outcomeAt: true,
      outcomeNotes: true,
      outcomeAudit: true,
      samOpportunity: {
        select: {
          id: true,
          source: true,
          title: true,
          agency: true,
          setAside: true,
          isSetAside: true,
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (existing.status !== 'SUBMITTED') {
    return NextResponse.json(
      { error: 'not_submitted', replay: { status: existing.status } },
      { status: 409 },
    );
  }
  if (existing.outcome != null && existing.outcomeAt != null) {
    const replay = BidOutcomeReplayEnvelope.parse({
      alreadyOutcome: true,
      outcome: existing.outcome,
      outcomeAt: existing.outcomeAt.toISOString(),
      outcomeNotes: existing.outcomeNotes ?? null,
      outcomeAudit: OutcomeAudit.parse(existing.outcomeAudit ?? []),
    });
    return NextResponse.json(replay, { status: 409 });
  }

  try {
    const result = await recordBidOutcome(id, user, parsed.data);
    if (result.outcome === 'WON' && existing.samOpportunity) {
      await notifyFounderOnBidOutcome({
        bidDraftId: result.id,
        source: existing.samOpportunity.source === 'UNISON' ? 'UNISON' : 'SAM',
        title: existing.samOpportunity.title ?? '(no title)',
        agency: existing.samOpportunity.agency ?? 'Unknown',
        setAside: existing.samOpportunity.setAside,
        isSetAside: existing.samOpportunity.isSetAside,
        outcomeAt: result.outcomeAt,
      });
    }
    const payload = BidOutcomeResult.parse({
      id: result.id,
      status: result.status,
      outcome: result.outcome,
      outcomeAt: result.outcomeAt.toISOString(),
      outcomeNotes: result.outcomeNotes,
      outcomeAudit: result.outcomeAudit,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    if (e instanceof BidOutcomeResponseError) {
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (e.code === 'not_submitted') {
        return NextResponse.json({ error: 'not_submitted' }, { status: 409 });
      }
      if (e.code === 'already_outcome') {
        return NextResponse.json({ error: 'already_outcome' }, { status: 409 });
      }
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'outcome_failed', detail: message }, { status: 500 });
  }
}
