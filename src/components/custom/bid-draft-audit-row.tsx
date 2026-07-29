// @polsia:user-owned — Pure-props audit row island. Renders the persisted
// submission audit log from the BidDraft envelope (no fetches — the parent
// already holds `data` after the GET /api/bid-drafts/<id> round-trip).
// Returns null when there is no audit to display (legacy / pre-submission
// drafts gracefully degrade to "Awaiting human submission").
'use client';

import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BidAudit, BidAuditEntry, BidDraftResult } from '@/lib/contracts/bid-draft';

interface Props {
  data: BidDraftResult;
}

const AUDIT_TS_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
  timeZoneName: 'short',
});

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${AUDIT_TS_FMT.format(d)}`;
}

function sortLatestFirst(entries: BidAudit): BidAuditEntry[] {
  // Stable sort by recordedAt (UTC ISO) descending. Newest first so the
  // operator sees the freshest submission at the top; deterministic so the
  // SSR/hydrate pair agrees.
  return [...entries].sort((a, b) => {
    if (a.recordedAt === b.recordedAt) return 0;
    return a.recordedAt < b.recordedAt ? 1 : -1;
  });
}

export function BidDraftAuditRow({ data }: Props) {
  const { draft } = data;
  const audit = draft.submissionAudit;
  if (!audit || audit.length === 0) return null;
  if (!draft.submittedAt || !draft.submittedByUserId) return null;

  const rows = sortLatestFirst(audit);

  return (
    <Card className="border-brand/40 bg-gradient-to-br from-brand-50/60 via-card to-card shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-700" />
          <span className="text-eyebrow text-brand-700">Submission audit log</span>
        </div>
        <CardTitle className="font-display text-xl mt-1 text-balance">
          Auditable submission record
        </CardTitle>
        <p className="text-caption text-muted-foreground mt-1">
          Snapshot of who pressed the submit button, against which draft revision, and from which
          source feed.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-brand text-brand-700 bg-card font-semibold">
            Submitted at {fmtTimestamp(draft.submittedAt)}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            actor: {draft.submittedByUserId}
          </Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {audit.length} audit {audit.length === 1 ? 'entry' : 'entries'}
          </Badge>
        </div>
        <ul
          aria-label="Submission audit entries"
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
        >
          {rows.map((entry) => (
            <li
              key={`${entry.recordedAt}-${entry.actor}-${entry.version}`}
              className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:gap-3"
              data-testid="bid-draft-audit-entry"
            >
              <div className="flex flex-col gap-1">
                <p className="text-body font-semibold tracking-tight">
                  {fmtTimestamp(entry.recordedAt)} — ({entry.source})
                </p>
                <p className="text-caption text-muted-foreground">
                  audit schema v{entry.version} · submitted against response revision{' '}
                  <span className="font-mono">{entry.responseVersion}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                <Badge variant="secondary" className="font-mono">
                  {entry.actor}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-brand text-brand-700 bg-card font-semibold tracking-wide"
                >
                  {entry.source}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
