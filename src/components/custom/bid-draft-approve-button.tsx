// @polsia:user-owned — Human-approval gate island. Posts the bid-draft
// status transition DRAFT → REVIEW via the authed + per-user scoped route
// handler. Disabled when status !== 'DRAFT' or the transition fires; shows
// a confirming toast on success. Pure client — no parent re-mount logic;
// the consumer (sam-detail or bid-draft-view) re-reads via apiFetch after
// the action.
'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { BidDraftStatusTransitionResult } from '@/lib/contracts/bid-draft';

type Status = 'DRAFT' | 'REVIEW' | 'SUBMITTED';
type TransitionTarget = 'DRAFT' | 'REVIEW' | 'SUBMITTED';

interface Props {
  draftId: string;
  status: Status;
  size?: 'sm' | 'lg';
  onTransitioned?: (target: TransitionTarget) => void;
}

export function BidDraftApproveButton({ draftId, status, size = 'sm', onTransitioned }: Props) {
  const [loading, setLoading] = useState(false);
  const disabled = status !== 'DRAFT' || loading || !draftId;

  const approve = useCallback(async () => {
    if (!draftId || status !== 'DRAFT') return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/bid-drafts/${encodeURIComponent(draftId)}/status`, {
        method: 'POST',
        schema: BidDraftStatusTransitionResult,
        body: JSON.stringify({ target: 'REVIEW' }),
      });
      toast.success(`Bid draft ${data.id} moved to REVIEW — awaiting human submission.`);
      onTransitioned?.('REVIEW');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Could not approve bid draft (${detail}).`);
    } finally {
      setLoading(false);
    }
  }, [draftId, status, onTransitioned]);

  return (
    <Button
      type="button"
      size={size}
      variant="default"
      onClick={approve}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="size-3.5" />
      )}
      {loading ? 'Approving…' : 'Approve & send to REVIEW'}
    </Button>
  );
}
