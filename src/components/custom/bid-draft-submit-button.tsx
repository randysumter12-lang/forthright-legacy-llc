// @polsia:user-owned — user-confirmation submit island. Posts the
// bid-draft submission to /api/bids/<id>/submit with the typed
// BidSubmitRequest envelope (responseVersion + source + confirm: true).
// Disabled when status !== 'REVIEW' so the UI gate mirrors the server-side
// human-confirmation seam. Toasts on success/failure; calls
// onTransitioned('SUBMITTED') so the parent re-reads via apiFetch.
'use client';

import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { BidSubmitRequest, BidSubmitResult } from '@/lib/contracts/bid-draft';

type Status = 'DRAFT' | 'REVIEW' | 'SUBMITTED';

interface Props {
  draftId: string;
  status: Status;
  responseVersion: number;
  source: 'SAM' | 'UNISON';
  size?: 'sm' | 'lg';
  onTransitioned?: (target: 'SUBMITTED') => void;
}

export function BidDraftSubmitButton({
  draftId,
  status,
  responseVersion,
  source,
  size = 'sm',
  onTransitioned,
}: Props) {
  const [loading, setLoading] = useState(false);
  const disabled = status !== 'REVIEW' || loading || !draftId;

  const submit = useCallback(async () => {
    if (!draftId || status !== 'REVIEW') return;
    setLoading(true);
    try {
      const body = BidSubmitRequest.parse({
        responseVersion,
        source,
        confirm: true,
      });
      const data = await apiFetch(`/api/bids/${encodeURIComponent(draftId)}/submit`, {
        method: 'POST',
        schema: BidSubmitResult,
        body: JSON.stringify(body),
      });
      toast.success(`Bid draft ${data.id} marked as SUBMITTED at ${data.submittedAt}.`);
      onTransitioned?.('SUBMITTED');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Could not submit bid draft (${detail}).`);
    } finally {
      setLoading(false);
    }
  }, [draftId, status, responseVersion, source, onTransitioned]);

  return (
    <Button
      type="button"
      size={size}
      variant="default"
      onClick={submit}
      disabled={disabled}
      aria-disabled={disabled}
      title={
        status !== 'REVIEW'
          ? 'Approve the draft first to move it into REVIEW before submitting.'
          : undefined
      }
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === 'SUBMITTED' ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <Send className="size-3.5" />
      )}
      {loading ? 'Submitting…' : status === 'SUBMITTED' ? 'Submitted' : 'Mark as submitted'}
    </Button>
  );
}
