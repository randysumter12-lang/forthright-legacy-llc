// @polsia:user-owned — Generate Bid Draft island. POSTs the bid-draft API
// for an opportunity, swaps the rendered draft inline on success, and
// surfaces toasts on failure. Mirrors capability-statement-button.tsx's
// toggle-then-render pattern; the renderer is the printable Markdown view.
'use client';

import { FileText, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { BidDraftView } from '@/components/custom/bid-draft-view';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type BidDraftResult,
  BidDraftResult as BidDraftResultSchema,
} from '@/lib/contracts/bid-draft';

interface Props {
  samOpportunityId: string;
  title?: string;
  onTransitioned?: () => void;
}

export function BidDraftButton({ samOpportunityId, title, onTransitioned }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BidDraftResult | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(
        `/api/sam-opportunities/${encodeURIComponent(samOpportunityId)}/bid-draft`,
        {
          method: 'POST',
          schema: BidDraftResultSchema,
        },
      );
      setResult(data);
      toast.success(`Bid draft generated (revision ${data.draft.revision}).`);
    } catch (err) {
      const cause = (err as { cause?: { error?: string } } | null)?.cause ?? null;
      const code = cause?.error ?? null;
      if (code === 'capability_statement_required') {
        toast.error(
          'Generate the Capability Statement first — it is the source for the bid draft.',
        );
        return;
      }
      const detail = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Could not generate bid draft (${detail}).`);
    } finally {
      setLoading(false);
    }
  }, [samOpportunityId]);

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-eyebrow text-brand-700 flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Human Review Required
            </span>
            <p className="text-body mt-1 leading-relaxed text-balance">
              Below is the bid response draft generated against{' '}
              <span className="font-semibold text-foreground">
                {result.draft.sections.cover.noticeId}
              </span>
              . The status flag is{' '}
              <span className="font-semibold text-foreground">{result.draft.status}</span> (revision{' '}
              {result.draft.revision}). Any future submission endpoint requires manual approval —
              this page does not submit on its own.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={generate} disabled={loading}>
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            {loading ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
        <BidDraftView data={result} onTransitioned={onTransitioned} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-brand bg-brand-50/30 p-6">
      <div>
        <span className="text-eyebrow text-brand-700 flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          One-Click Bid Draft
        </span>
        <h2 className="font-display text-xl xl:text-2xl font-semibold mt-1 text-balance">
          Generate the bid response draft
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          {title
            ? `Composes a printable Markdown bid response for ${title} — covering cover page, technical approach, staffing, pricing, past performance, and a compliance matrix.`
            : 'Composes a printable Markdown bid response that the founder-operators manually review before any submission endpoint fires.'}
        </p>
      </div>
      <Button type="button" size="lg" onClick={generate} disabled={loading}>
        <Sparkles className={loading ? 'size-4 animate-pulse' : 'size-4'} />
        {loading ? 'Generating…' : 'Generate'}
      </Button>
    </div>
  );
}
