// @polsia:user-owned — "Qualifying this week" 3-stat widget for /dashboard.
// Each card follows the outcome-strip midnight palette: deep `--brand-800`
// surface, brushed-silver `--accent` icon chip, eyebrow + figure in silver,
// hint text in muted silver. Three states: loading (skeleton), error (muted
// alert), ready (numbers).
'use client';

import { AlertCircle, CalendarClock, FileSignature, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { DashboardSummary } from '@/lib/contracts/dashboard';

type State =
  | { status: 'loading' }
  | { status: 'ready'; summary: DashboardSummary }
  | { status: 'error'; message: string };

interface StatCardSpec {
  key: 'qualifying' | 'deadline' | 'drafts';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  value: number;
}

export function QualifyingThisWeekWidget() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiFetch<DashboardSummary>('/api/dashboard/summary', { schema: DashboardSummary })
      .then((summary) => {
        if (!cancelled) setState({ status: 'ready', summary });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load the weekly summary.';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <WidgetSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <Card role="alert" className="border-destructive/40 bg-destructive/5 shadow-sm">
        <CardContent className="flex items-start gap-3 p-6">
          <div className="flex size-10 items-center justify-center rounded-md bg-destructive/15 text-destructive">
            <AlertCircle className="size-5" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow text-destructive">This week</p>
            <p className="text-small font-semibold text-foreground">
              Could not load the weekly summary
            </p>
            <p className="text-caption text-muted-foreground">{state.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cards: StatCardSpec[] = [
    {
      key: 'qualifying',
      label: 'Qualifying this week',
      icon: Sparkles,
      hint: 'Opportunities matching your set-aside profile across all deadlines.',
      value: state.summary.qualifyingThisWeek,
    },
    {
      key: 'deadline',
      label: 'Deadline approaching',
      icon: CalendarClock,
      hint: 'Qualifying opportunities due in the next 7 days.',
      value: state.summary.deadlineSoon,
    },
    {
      key: 'drafts',
      label: 'Open bid drafts',
      icon: FileSignature,
      hint: 'Drafts awaiting your review or submission.',
      value: state.summary.openBidDrafts,
    },
  ];

  return (
    <section aria-label="Qualifying this week" className="grid gap-4 md:grid-cols-3">
      {cards.map(({ key, label, icon: Icon, hint, value }) => (
        <Card
          key={key}
          className="relative overflow-hidden border-[var(--accent)]/30 bg-brand-800 text-[var(--accent)] shadow-brand"
        >
          <div className="pointer-events-none absolute inset-0 bg-[var(--accent)]/5" aria-hidden />
          <CardContent className="relative flex h-full flex-col gap-3 p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex size-10 items-center justify-center rounded-md bg-[var(--accent)]/15 text-[var(--accent)]">
                <Icon className="size-5" aria-hidden />
              </div>
              <p className="text-caption font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                This week
              </p>
            </div>
            <p
              aria-live="polite"
              className="font-display text-h2 leading-none font-bold tracking-tight text-[var(--accent)]"
            >
              {value.toLocaleString('en-US')}
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-small font-semibold text-[var(--accent)]">{label}</p>
              <p className="text-caption text-[var(--accent)]/80">{hint}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function WidgetSkeleton() {
  return (
    <section aria-label="Qualifying this week" className="grid gap-4 md:grid-cols-3">
      {(['q', 'd', 'r'] as const).map((key) => (
        <Card
          key={key}
          className="relative overflow-hidden border-[var(--accent)]/30 bg-brand-800/80 shadow-sm"
        >
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-48" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
