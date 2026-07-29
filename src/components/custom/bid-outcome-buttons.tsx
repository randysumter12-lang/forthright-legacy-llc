// @polsia:user-owned — outcome buttons island for /sam/<id>. Renders the
// three "Mark Won / Lost / No response" buttons alongside an inline note
// textarea when the parent <SamDetail> reports draftStatus === 'SUBMITTED'
// AND outcome is still null. POSTs the typed BidOutcomeRequest to
// /api/bids/<id>/outcome; on success, calls onTransitioned?.(outcome) so
// the parent re-reads the SamOpportunityDetail envelope (no full nav).
//
// Mirrors <BidDraftSubmitButton> posture: disabled while in-flight, hides
// the moment `outcome` is populated (parent passes `outcome` so the island
// itself becomes a no-op once the chip flips). On 409 already_outcome /
// not_submitted, the parent refresh would resurface the right chip — we
// still toast the error so a stale tab leaves a visible trail.
'use client';

import { CheckCircle2, CircleSlash, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { type BidOutcome, BidOutcomeRequest, BidOutcomeResult } from '@/lib/contracts/bid-draft';

interface Props {
  draftId: string;
  outcome: BidOutcome | null | undefined;
  onTransitioned?: (outcome: BidOutcome) => void;
}

interface OutcomeActionConfig {
  outcome: BidOutcome;
  label: string;
  icon: React.ReactNode;
  buttonVariant: 'default' | 'destructive' | 'outline';
  ariaLabel: string;
  intent: 'positive' | 'negative' | 'neutral';
}

const ACTION_BUTTONS: readonly OutcomeActionConfig[] = [
  {
    outcome: 'WON',
    label: 'Mark Won',
    icon: <ThumbsUp className="size-3.5" />,
    buttonVariant: 'default',
    ariaLabel: 'Mark this submitted bid as Won.',
    intent: 'positive',
  },
  {
    outcome: 'LOST',
    label: 'Mark Lost',
    icon: <ThumbsDown className="size-3.5" />,
    buttonVariant: 'destructive',
    ariaLabel: 'Mark this submitted bid as Lost.',
    intent: 'negative',
  },
  {
    outcome: 'NO_RESPONSE',
    label: 'Mark No Response',
    icon: <CircleSlash className="size-3.5" />,
    buttonVariant: 'outline',
    ariaLabel: 'Mark this submitted bid as No Response (the agency did not reply).',
    intent: 'neutral',
  },
];

const NOTES_MAX = 2000;

export function BidOutcomeButtons({ draftId, outcome, onTransitioned }: Props) {
  const [loading, setLoading] = useState(false);
  const [activeOutcome, setActiveOutcome] = useState<BidOutcome | null>(null);
  const [notes, setNotes] = useState('');

  const record = useCallback(
    async (target: BidOutcome) => {
      if (!draftId || outcome != null || loading) return;
      setLoading(true);
      setActiveOutcome(target);
      try {
        const body = BidOutcomeRequest.parse({
          outcome: target,
          outcomeNotes: notes.trim().length > 0 ? notes.trim() : undefined,
        });
        const data = await apiFetch(`/api/bids/${encodeURIComponent(draftId)}/outcome`, {
          method: 'POST',
          schema: BidOutcomeResult,
          body: JSON.stringify(body),
        });
        toast.success(
          `Bid draft ${data.id} marked as ${target}. Outcome persisted at ${data.outcomeAt}.`,
        );
        onTransitioned?.(target);
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Could not record outcome (${detail}).`);
      } finally {
        setLoading(false);
        setActiveOutcome(null);
      }
    },
    [draftId, outcome, loading, notes, onTransitioned],
  );

  // Render nothing the moment an outcome is already on the row — the chip
  // in the header takes over. The first-wins posture mirrors the submit
  // button's idempotency pattern.
  if (outcome != null) {
    return <CheckCircle2 className="size-4 text-green-700" aria-hidden />;
  }

  return (
    <fieldset
      className="m-0 flex w-full flex-col gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 shadow-sm"
      aria-label="Record bid outcome"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-eyebrow text-muted-foreground">Record outcome</p>
        <p className="text-caption text-muted-foreground ml-auto">
          First outcome wins — subsequent records are no-ops.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTION_BUTTONS.map((cfg) => {
          const isActive = loading && activeOutcome === cfg.outcome;
          const disabled = loading || !draftId;
          return (
            <Button
              key={cfg.outcome}
              type="button"
              size="sm"
              variant={cfg.buttonVariant}
              onClick={() => record(cfg.outcome)}
              disabled={disabled}
              aria-disabled={disabled}
              aria-label={cfg.ariaLabel}
              title={cfg.ariaLabel}
            >
              {isActive ? <Loader2 className="size-3.5 animate-spin" /> : cfg.icon}
              {isActive ? 'Recording…' : cfg.label}
            </Button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-eyebrow text-muted-foreground">Outcome note (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
          maxLength={NOTES_MAX}
          rows={2}
          placeholder="Free-text context (≤ 2000 chars)."
          disabled={loading}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-small leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
        />
      </label>
    </fieldset>
  );
}
