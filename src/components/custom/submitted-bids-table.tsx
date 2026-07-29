// @polsia:user-owned — client island for /submitted-bids. Reads the per-user
// submission inventory through /api/bids?status=submitted and renders a
// single Card-shell table surfacing every submission row at a glance:
// title (linking back to /sam/<id>), agency, submission timestamp, source
// chip, outcome chip (Won/Lost/No response when recorded), set-aside chip,
// deadline urgency badge, and the count of audit entries. Reuses
// <SourceBadge>, <DeadlineUrgencyBadge>, <OutcomeChip>, and the set-aside
// chip idiom from /sam.
'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OutcomeChip } from '@/components/custom/bid-outcome-chip';
import { DeadlineUrgencyBadge } from '@/components/custom/deadline-urgency-badge';
import { SourceBadge } from '@/components/custom/source-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import {
  SubmittedBids,
  type SubmittedBids as SubmittedBidsContract,
} from '@/lib/contracts/submitted-bids';

interface State {
  status: 'loading' | 'ready' | 'error' | 'empty';
  data: SubmittedBidsContract | null;
  errorMessage: string | null;
}

const timestampFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
});

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : timestampFmt.format(d);
}

export function SubmittedBidsTable() {
  const [state, setState] = useState<State>({
    status: 'loading',
    data: null,
    errorMessage: null,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch('/api/bids?status=submitted', { schema: SubmittedBids });
        if (!active) return;
        if (data.items.length === 0) {
          setState({ status: 'empty', data: null, errorMessage: null });
        } else {
          setState({ status: 'ready', data, errorMessage: null });
        }
      } catch (err) {
        if (!active) return;
        setState({
          status: 'error',
          data: null,
          errorMessage:
            err instanceof Error ? err.message : 'Failed to load submitted bids from the API.',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="border-border/70 shadow-md">
      <CardHeader>
        <CardTitle className="font-display text-h3 tracking-tight">
          Every bid you&apos;ve shipped
        </CardTitle>
        <p className="text-caption text-muted-foreground">
          Submission timestamp, provenance chip, set-aside designation, deadline urgency, and audit
          entry count — one row per shipped draft.
        </p>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' ? <TableSkeleton /> : null}

        {state.status === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4"
          >
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" />
              <p className="text-small font-semibold">Could not load submitted bids</p>
            </div>
            <p className="text-caption text-muted-foreground">{state.errorMessage}</p>
          </div>
        ) : null}

        {state.status === 'empty' ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-small text-muted-foreground">No submitted bids yet.</p>
            <p className="text-caption text-muted-foreground mt-1">
              Once a bid draft is reviewed and marked submitted, it appears here.
            </p>
          </div>
        ) : null}

        {state.status === 'ready' && state.data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Set-aside</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Audit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/sam/${item.opportunity.id}`}
                      className="font-display text-body font-semibold leading-snug text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
                    >
                      {item.opportunity.title || 'Untitled opportunity'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-small">
                    {item.opportunity.agency || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-caption whitespace-nowrap">
                    {formatTimestamp(item.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={item.source} />
                  </TableCell>
                  <TableCell>
                    {item.outcome != null ? (
                      <OutcomeChip outcome={item.outcome} title="Recorded on the bid draft row." />
                    ) : (
                      <span className="text-muted-foreground text-caption">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.opportunity.isSetAside && item.opportunity.setAside ? (
                      <Badge variant="outline" className="border-brand text-brand-700 bg-brand-50">
                        {item.opportunity.setAside}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-caption">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DeadlineUrgencyBadge dueDate={item.opportunity.dueDate} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{item.submissionAuditCount}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {['sk-0', 'sk-1', 'sk-2', 'sk-3'].map((key) => (
        <div key={key} className="flex items-center gap-4 rounded-md border border-border/60 p-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="ml-auto h-5 w-10" />
        </div>
      ))}
    </div>
  );
}
