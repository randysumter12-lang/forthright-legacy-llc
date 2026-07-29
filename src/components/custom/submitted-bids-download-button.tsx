// @polsia:user-owned — Download CSV button for /submitted-bids. Mounts in the
// page header next to the H1. Reads the SUBMITTED-bids count + the caller's
// subscription tier on mount; renders nothing if the user is below
// PROFESSIONAL or has zero submissions. On click, streams the CSV via a
// blob + transient `<a download>` click — no new browser tab, no
// `window.open`, no `target="_blank"`.
//
// The actual download uses NATIVE `fetch`, not `apiFetch`: apiFetch always
// `res.json()`s the body, which would corrupt the CSV byte stream. Reading
// the body as `text()` keeps the CRLF line endings + UTF-8 BOM intact so
// Excel/LibreOffice auto-detect encoding correctly.

'use client';

import { Download, FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { SubmittedBids } from '@/lib/contracts/submitted-bids';
import { SubscriptionEnvelope, type Tier } from '@/lib/contracts/subscription';

type View =
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'ready' }
  | { status: 'downloading' }
  | { status: 'error' };

function tierAllowed(tier: Tier): boolean {
  return tier === 'PROFESSIONAL' || tier === 'ELITE';
}

async function triggerDownload(): Promise<void> {
  const res = await fetch('/api/bids/export', { method: 'GET', credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'submitted-bids.csv';
  a.rel = 'noopener';
  // Mount to the body so some browsers resolve relative `download` paths.
  document.body.appendChild(a);
  // Click on the next tick + revoke URL on the same tick so Safari doesn't
  // cancel the download before the blob is wired up.
  setTimeout(() => {
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export function SubmittedBidsDownloadButton() {
  const [view, setView] = useState<View>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sub, bids] = await Promise.all([
          apiFetch('/api/billing/subscription', { schema: SubscriptionEnvelope }),
          apiFetch('/api/bids?status=submitted', { schema: SubmittedBids }),
        ]);
        if (cancelled) return;
        const tier: Tier = sub.active && sub.subscription ? sub.subscription.tier : 'STARTER';
        if (!tierAllowed(tier) || bids.items.length === 0) {
          setView({ status: 'hidden' });
          return;
        }
        setView({ status: 'ready' });
      } catch {
        if (cancelled) return;
        // 401 / 402 / network blip — don't render a button that would
        // return an error envelope on click; the user will see the button
        // again on next navigation if their tier/count permits.
        setView({ status: 'hidden' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.status === 'hidden') return null;

  if (view.status === 'loading' || view.status === 'downloading') {
    return (
      <Button type="button" variant="outline" disabled aria-busy="true">
        <Download className="size-4" aria-hidden />
        Preparing…
      </Button>
    );
  }

  if (view.status === 'error') {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setView({ status: 'ready' });
          }}
        >
          <FileDown className="size-4" aria-hidden />
          Download CSV
        </Button>
        <p role="alert" className="text-caption text-destructive">
          Couldn&apos;t prepare the file — try again.
        </p>
      </div>
    );
  }

  // view.status === 'ready'
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        setView({ status: 'downloading' });
        try {
          await triggerDownload();
          setView({ status: 'ready' });
        } catch {
          setView({ status: 'error' });
        }
      }}
    >
      <FileDown className="size-4" aria-hidden />
      Download CSV
    </Button>
  );
}
