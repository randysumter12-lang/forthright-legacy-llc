// @polsia:user-owned — Generate-button island. POSTs the capability-statement
// API for an opportunity, swaps the rendered view inline on success, and
// surfaces toasts on failure. Mirrors sam-refresh-button's error handling.
'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CapabilityStatementView } from '@/components/custom/capability-statement-view';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type CapabilityStatementResult,
  CapabilityStatementResult as CapabilityStatementResultSchema,
} from '@/lib/contracts/capability-statement';

interface Props {
  samOpportunityId: string;
  title?: string;
}

export function CapabilityStatementButton({ samOpportunityId, title }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CapabilityStatementResult | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(
        `/api/sam-opportunities/${encodeURIComponent(samOpportunityId)}/capability-statement`,
        {
          method: 'POST',
          schema: CapabilityStatementResultSchema,
        },
      );
      setResult(data);
      toast.success('Capability Statement generated.');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Could not generate (${detail}).`);
    } finally {
      setLoading(false);
    }
  }, [samOpportunityId]);

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-muted-foreground">
            Below is the live Capability Statement generated against{' '}
            <span className="font-semibold text-foreground">
              {result.statement.cover.generatedFor.noticeId}
            </span>
            .
          </p>
          <Button type="button" variant="outline" size="sm" onClick={generate} disabled={loading}>
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            {loading ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
        <CapabilityStatementView data={result.statement} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-brand bg-brand-50/30 p-6">
      <div>
        <span className="text-eyebrow text-brand-700 flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          One-Click Capability Statement
        </span>
        <h2 className="font-display text-xl xl:text-2xl font-semibold mt-1 text-balance">
          Generate the capability statement for this opportunity
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          {title
            ? `Composes a tailored JSON Capability Statement for ${title} and Rigel Solutions'`
            : "Composes a tailored JSON Capability Statement using the founder's"}{' '}
          Active Duty U.S. Navy + Minority-Owned profile and saves it for audit.
        </p>
      </div>
      <Button type="button" size="lg" onClick={generate} disabled={loading}>
        <Sparkles className={loading ? 'size-4 animate-pulse' : 'size-4'} />
        {loading ? 'Generating…' : 'Generate'}
      </Button>
    </div>
  );
}
