// @polsia:user-owned — live SAM.gov + Unison Global feed island. Reads via
// apiFetch (the only allowed data transport) and renders the parsed
// SamOpportunityList contract. Source badge, deadline urgency, and an
// "Awaiting Review" chip are wired so the daily queue communicates
// provenance + readiness at a glance. Sort key is urgency-then-original so
// OVERDUE / IMMINENT rise to the top while preserving the API's
// postedDate desc ordering inside each bucket.
'use client';

import { AlertCircle, ArrowRight, ArrowUpRight, MapPin, Tag } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeadlineUrgencyBadge } from '@/components/custom/deadline-urgency-badge';
import { SamRefreshButton } from '@/components/custom/sam-refresh-button';
import { SourceBadge } from '@/components/custom/source-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { sortByUrgency } from '@/lib/business/sam-deadline';
import { matchesSetAsideFilter, SET_ASIDE_CHIP_KEYS } from '@/lib/business/sam-filter';
import {
  SamListError,
  type SamOpportunityItem,
  SamOpportunityList,
} from '@/lib/contracts/sam-opportunity';
import { cn } from '@/lib/utils';

type SamListDiagnostic = SamListError['diagnostic'];

interface FeedState {
  status: 'loading' | 'ready' | 'error';
  data: SamOpportunityList | null;
  errorMessage: string | null;
  errorRef: string | null;
  errorDiagnostic: SamListDiagnostic | null;
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
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

const CATEGORY_LABEL: Record<string, string> = {
  IT_SERVICES: 'IT Services',
  CMMC: 'CMMC Pre-Review',
  CONSULTING: 'Consulting',
  OTHER: 'Other',
};

export interface SamFeedProps {
  onRefreshStateChange?: (loading: boolean) => void;
  onAfterRefresh?: () => void;
}

export function SamFeed({ onRefreshStateChange, onAfterRefresh }: SamFeedProps = {}) {
  const [state, setState] = useState<FeedState>({
    status: 'loading',
    data: null,
    errorMessage: null,
    errorRef: null,
    errorDiagnostic: null,
  });
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  // Mount guard for in-flight fetches: prevents
  //   setState({...}) on an unmounted component
  // warnings from `load()` and its caller `handleRefreshComplete` when the
  // user navigates away from /sam during display: Slow 3G / mid-refresh.
  // Mirrors the pattern used in sam-detail.tsx.
  const mountedRef = useRef(true);

  const toggleChip = useCallback((key: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveChips(new Set());
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      status: 'loading',
      errorMessage: null,
      errorRef: null,
      errorDiagnostic: null,
    }));
    try {
      const data = await apiFetch('/api/sam-opportunities?limit=20', {
        schema: SamOpportunityList,
      });
      if (!mountedRef.current) return;
      setState({
        status: 'ready',
        data,
        errorMessage: null,
        errorRef: null,
        errorDiagnostic: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      // Per-failure attribution: a stable id rendered next to the message so
      // a bug report can be tied to a single `load()` invocation. The id
      // resets every time `load()` runs (so a fresh load retries with a
      // fresh id once the network recovers), but the card shown for a
      // given failure freezes it for the lifetime of that failure.
      const ref =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `sam-feed-${Date.now()}`;
      // apiFetch sets the parsed JSON body as the Error's `cause`. If the
      // body matches the SamListError contract (the route returns 503 +
      // {error: 'sam_list_failed', diagnostic: {...}} on any Prisma throw),
      // surface the structured diagnostic so the next operator reads the
      // actual Prisma code + message instead of the misleading generic
      // DATABASE_URL hint.
      let diagnostic: SamListError['diagnostic'] | null = null;
      if (err instanceof Error && err.cause !== undefined) {
        const parsed = SamListError.safeParse(err.cause);
        if (parsed.success) diagnostic = parsed.data.diagnostic;
      }
      setState({
        status: 'error',
        data: null,
        errorMessage:
          err instanceof Error ? err.message : 'Failed to load opportunities from the API.',
        errorRef: ref,
        errorDiagnostic: diagnostic,
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const handleRefreshState = useCallback(
    (loading: boolean) => {
      onRefreshStateChange?.(loading);
    },
    [onRefreshStateChange],
  );

  const handleRefreshComplete = useCallback(() => {
    onAfterRefresh?.();
    void load();
  }, [load, onAfterRefresh]);

  const filteredItems = useMemo(
    () =>
      state.data ? state.data.items.filter((op) => matchesSetAsideFilter(op, activeChips)) : [],
    [state.data, activeChips],
  );
  const sortedItems = useMemo(() => sortByUrgency(filteredItems), [filteredItems]);
  const hasUnderlyingRows = (state.data?.items.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-eyebrow">Live Feed</span>
          <h2 className="font-display text-2xl xl:text-3xl font-bold tracking-tight">
            Latest $3.5K–$10K Micro-Purchases
          </h2>
          {state.data?.lastRun ? (
            <p className="text-caption text-muted-foreground mt-1">
              Last run: <RunStatusBadge status={state.data.lastRun.status} /> ·{' '}
              {state.data.lastRun.upsertedCount ?? 0} new / {state.data.lastRun.fetchedCount ?? 0}{' '}
              fetched ·{' '}
              {state.data.lastRun.startedAt ? formatDate(state.data.lastRun.startedAt) : 'never'}
            </p>
          ) : (
            <p className="text-caption text-muted-foreground mt-1">
              Last run: never — click <em>Run scrape now</em> to populate.
            </p>
          )}
        </div>
        <SamRefreshButton onComplete={handleRefreshComplete} onLoadingChange={handleRefreshState} />
      </header>

      <fieldset
        aria-label="Filter by set-aside"
        className="flex flex-wrap items-center gap-2 border-0 p-0 m-0"
      >
        <legend className="sr-only">Filter by set-aside</legend>
        <FilterChip
          label="All"
          isActive={activeChips.size === 0}
          onClick={clearFilters}
          count={state.data?.items.length ?? 0}
        />
        {SET_ASIDE_CHIP_KEYS.map((key) => (
          <FilterChip
            key={key}
            label={key}
            isActive={activeChips.has(key)}
            onClick={() => toggleChip(key)}
            count={state.data ? chipMatchCount(state.data.items, key) : 0}
          />
        ))}
      </fieldset>

      {state.status === 'loading' && state.data === null ? <FeedSkeleton /> : null}

      {state.status === 'error' ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" />
              <h3 className="font-semibold">Could not load the SAM feed</h3>
            </div>
            <ErrorDetail message={state.errorMessage} diagnostic={state.errorDiagnostic} />
            {state.errorRef ? (
              <p className="text-caption text-muted-foreground font-mono">
                Ref sam-feed-{state.errorRef}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {state.status !== 'error' && state.data && filteredItems.length === 0 ? (
        hasUnderlyingRows ? (
          <Card className="border-dashed bg-muted/30">
            <CardHeader>
              <CardTitle>No opportunities match this filter</CardTitle>
              <CardDescription>
                Tap <em>All</em> to clear the chip selection and see every fetched row again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardHeader>
              <CardTitle>No opportunities yet</CardTitle>
              <CardDescription>
                The scraper hasn&apos;t produced any rows yet, or none matched today&apos;s
                micro-purchase window. Hit <em>Run scrape now</em> to attempt a fresh pull.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      {state.status !== 'error' && sortedItems.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((op) => (
            <li key={op.id}>
              <Link
                href={`/sam/${op.id}`}
                className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Card className="lift h-full">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceBadge source={op.source ?? 'SAM'} size="sm" />
                        <Badge variant="secondary" className="text-caption">
                          {CATEGORY_LABEL[op.category] ?? op.category}
                        </Badge>
                      </div>
                      {op.isSetAside && op.setAside ? (
                        <Badge variant="outline" className="text-caption">
                          {op.setAside}
                        </Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-base leading-snug mt-1">{op.title}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3" />
                        {op.agency}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Tag className="size-3" />
                        NAICS {op.naicsCode}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Due {formatDate(op.dueDate)}</span>
                        <DeadlineUrgencyBadge dueDate={op.dueDate} />
                      </div>
                      <span className="font-semibold text-primary">
                        {formatCurrency(op.awardValue)}
                      </span>
                    </div>
                    {op.draftStatus === 'DRAFT' ? <AwaitingReviewChip /> : null}
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{op.noticeId}</span>
                      <span className="flex items-center gap-3">
                        {op.uiLink ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRight className="size-3" />
                            <span>SAM.gov</span>
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                          View detail
                          <ArrowRight className="size-3" />
                        </span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'OK'
      ? 'default'
      : status === 'RATE_LIMITED'
        ? 'secondary'
        : status === 'RUNNING'
          ? 'secondary'
          : 'destructive';
  return (
    <Badge variant={variant} className="text-caption align-middle">
      {status}
    </Badge>
  );
}

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count: number;
}

function FilterChip({ label, isActive, onClick, count }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isActive
          ? 'border-brand bg-brand-50 text-brand-700'
          : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 text-[10px] tabular-nums',
          isActive ? 'bg-brand-100 text-brand-700' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function chipMatchCount(items: SamOpportunityItem[], key: string): number {
  const set = new Set([key]);
  return items.filter((op) => matchesSetAsideFilter(op, set)).length;
}

interface ErrorDetailProps {
  message: string | null;
  diagnostic: SamListError['diagnostic'] | null;
}

// Branch the visible surface on what kind of failure the route actually
// reported:
//   - schema_mismatch / connectivity → keep the operator-actionable DATABASE_URL
//     hint and append the real Prisma code + message (the two pieces of
//     diagnostic the hint was failing to surface).
//   - other / unknown                 → generic "temporarily unavailable"
//     copy + the raw code + message so the bug report is self-contained.
//   - no diagnostic parsed            → fall back to the pre-existing message
//     and DATABASE_URL hint (handles non-Prisma throws / network 4xx).
function ErrorDetail({ message, diagnostic }: ErrorDetailProps) {
  if (!diagnostic) {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          {message ?? 'There was a problem reaching the server.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Verify <code className="text-xs">DATABASE_URL</code> is set and the schema was pushed via{' '}
          <code className="text-xs">npx prisma db push</code>.
        </p>
      </>
    );
  }
  if (diagnostic.kind === 'schema_mismatch' || diagnostic.kind === 'connectivity') {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          {message ?? 'There was a problem reaching the server.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Verify <code className="text-xs">DATABASE_URL</code> is set and the schema was pushed via{' '}
          <code className="text-xs">npx prisma db push</code>.
        </p>
        <p className="text-sm text-muted-foreground">
          Underlying error: <code className="text-xs">{diagnostic.code}</code> —{' '}
          {diagnostic.message}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        The SAM feed is temporarily unavailable — please retry.
      </p>
      <p className="text-sm text-muted-foreground">
        Underlying error: <code className="text-xs">{diagnostic.code}</code> — {diagnostic.message}
      </p>
    </>
  );
}

function AwaitingReviewChip() {
  return (
    <Badge
      variant="outline"
      className="self-start border-amber-400 bg-amber-100/40 text-amber-900 text-caption font-semibold"
    >
      Awaiting Review
    </Badge>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {SKELETON_KEYS.map((k) => (
        <Card key={k} className="h-full">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-3/4 mt-2" />
            <Skeleton className="h-3 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full mt-3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const SKELETON_KEYS = ['sk-0', 'sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'];
