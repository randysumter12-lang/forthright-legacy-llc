// @polsia:user-owned — Today's Bid Queue island. Reads the per-user scoped
// /api/bid-drafts list and renders up to N rows with title, due date, award
// value, source, and a status chip the operator can scan in 5 seconds.
// Each row links to /sam/[id]/draft where the operator can review and
// approve the bid package.
'use client';

import { AlertCircle, ArrowUpRight, Calendar, FileText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SourceBadge } from '@/components/custom/source-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import type { BidDraftList } from '@/lib/contracts/bid-draft';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
});
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return currencyFmt.format(value);
}

interface QueueState {
  status: 'loading' | 'ready' | 'error';
  data: BidDraftList | null;
  errorMessage: string | null;
}

const LIMIT = 10;

export function TodaysBidQueue() {
  const [state, setState] = useState<QueueState>({
    status: 'loading',
    data: null,
    errorMessage: null,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch(`/api/bid-drafts?limit=${LIMIT}`, {
          schema: (await import('@/lib/contracts/bid-draft')).BidDraftList,
        });
        if (!active) return;
        setState({ status: 'ready', data, errorMessage: null });
      } catch (err) {
        if (!active) return;
        setState({
          status: 'error',
          data: null,
          errorMessage: err instanceof Error ? err.message : 'Failed to load the bid queue.',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const lastRun = state.data?.lastAutoDraftRun;
  const drafted = lastRun?.drafted ?? 0;
  const considered = lastRun?.considered ?? 0;
  const qualified = lastRun?.qualified ?? 0;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-eyebrow">Today&apos;s bid queue</p>
            <h3 className="font-display text-h3 tracking-tight text-foreground">
              Pre-drafted bids awaiting your review
            </h3>
            <p className="mt-1 text-small text-muted-foreground">
              Each nightly run produces {drafted ? `${drafted} drafted` : 'a queue of pre-drafted'}{' '}
              bid packages from {considered} considered / {qualified} qualified micro-purchase
              opportunities. Approve each one before submission.
            </p>
          </div>
          <FileText className="size-6 text-[var(--accent)]" aria-hidden />
        </div>

        {state.status === 'loading' ? <QueueSkeleton /> : null}

        {state.status === 'error' ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" />
              <p className="text-small font-semibold">Could not load the bid queue</p>
            </div>
            <p className="text-caption text-muted-foreground">{state.errorMessage}</p>
          </div>
        ) : null}

        {state.status === 'ready' && state.data && state.data.items.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-4">
            <p className="text-small text-muted-foreground">
              No bid drafts yet — the next nightly pipeline will pull SAM.gov + Unison Global,
              qualify each opportunity, and draft a package for your review.
            </p>
          </div>
        ) : null}

        {state.status === 'ready' && state.data && state.data.items.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/sam/${item.opportunity.id}/draft`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceBadge source={item.opportunity.source ?? 'SAM'} size="sm" />
                        <Badge variant="secondary" className="text-caption">
                          {categoryLabel(item.opportunity.category)}
                        </Badge>
                        {item.opportunity.setAside ? (
                          <Badge variant="outline" className="text-caption">
                            {item.opportunity.setAside}
                          </Badge>
                        ) : null}
                      </div>
                      <StatusChip status={item.status} />
                    </div>
                    <p className="font-display text-base font-semibold leading-snug text-foreground">
                      {item.opportunity.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Due {formatDate(item.opportunity.dueDate)}
                      </span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(item.opportunity.awardValue)}
                      </span>
                      <span className="font-mono">{item.opportunity.noticeId}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 text-caption">
                      <span className="text-muted-foreground">
                        Revision {item.revision} · updated {formatDate(item.updatedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        Open draft
                        <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-caption text-muted-foreground">
            {lastRun
              ? `Last run: ${
                  lastRun.finishedAt ? formatDate(lastRun.finishedAt) : 'in progress'
                } — ${
                  lastRun.status
                } · ${drafted} drafted / ${qualified} qualified / ${considered} considered`
              : 'No auto-draft run recorded yet.'}
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sam">View live feed</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusChip({ status }: { status: 'DRAFT' | 'REVIEW' | 'SUBMITTED' }) {
  if (status === 'REVIEW') {
    return (
      <Badge
        variant="outline"
        className="border-brand text-brand-700 bg-brand-50 text-caption font-semibold"
      >
        In review
      </Badge>
    );
  }
  if (status === 'SUBMITTED') {
    return (
      <Badge
        variant="default"
        className="bg-brand text-brand-foreground text-caption font-semibold"
      >
        Submitted
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-400 bg-amber-100/40 text-amber-900 text-caption font-semibold"
    >
      Awaiting review
    </Badge>
  );
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    IT_SERVICES: 'IT Services',
    CMMC: 'CMMC Pre-Review',
    CONSULTING: 'Consulting',
    OTHER: 'Other',
  };
  return labels[category] ?? category;
}

function QueueSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {['q-0', 'q-1', 'q-2', 'q-3'].map((key) => (
        <div key={key} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3 mt-2" />
          <Skeleton className="h-3 w-1/2 mt-3" />
        </div>
      ))}
    </div>
  );
}
