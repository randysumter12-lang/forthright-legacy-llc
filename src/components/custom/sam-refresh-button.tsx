// @polsia:user-owned — manual trigger UI. POSTs to /api/sam-opportunities/refresh
// and reports the result via toast.
'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { SamOpportunityTriggerResult } from '@/lib/contracts/sam-opportunity';

export function SamRefreshButton({
  onComplete,
  onLoadingChange,
}: {
  onComplete?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const trigger = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const data = await apiFetch('/api/sam-opportunities/refresh', {
        method: 'POST',
        schema: SamOpportunityTriggerResult,
      });
      if (data.run.status === 'OK') {
        toast.success(`Scrape complete — ${data.run.upsertedCount} opportunity(ies) upserted.`);
      } else if (data.run.status === 'RATE_LIMITED') {
        toast.warning('SAM.gov rate-limited this run. Existing data is intact; try again later.');
      } else if (data.run.status === 'ERROR') {
        toast.error(`Scrape failed: ${data.run.errorMessage ?? 'unknown error'}`);
      } else {
        toast.message(`Scrape ${data.run.status.toLowerCase()} — check Last run for details.`);
      }
      onComplete?.();
    } catch (err) {
      // 503 (manual trigger disabled) lands here too; surface a useful hint.
      const detail = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Could not run the scrape (${detail}).`);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [onComplete, onLoadingChange]);

  return (
    <Button onClick={trigger} disabled={loading} type="button" variant="outline" size="sm">
      <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
      {loading ? 'Running…' : 'Run scrape now'}
    </Button>
  );
}
