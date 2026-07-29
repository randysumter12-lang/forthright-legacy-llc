// @polsia:user-owned — single most-recent opportunity tile for the home
// CTA section. Fetches /api/sam-opportunities?limit=1 on mount.
'use client';

import { ArrowUpRight, Calendar, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DeadlineUrgencyBadge } from '@/components/custom/deadline-urgency-badge';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { SamOpportunityList } from '@/lib/contracts/sam-opportunity';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface State {
  status: 'loading' | 'ready' | 'empty';
  headline: string | null;
  agency: string | null;
  naics: string | null;
  due: string | null;
  value: number | null;
  category: string | null;
  link: string | null;
  source: 'SAM' | 'UNISON' | null;
}

const EMPTY_STATE: State = {
  status: 'empty',
  headline: null,
  agency: null,
  naics: null,
  due: null,
  value: null,
  category: null,
  link: null,
  source: null,
};

export function SamLatestTile() {
  const [state, setState] = useState<State>({ ...EMPTY_STATE, status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch('/api/sam-opportunities?limit=1', {
          schema: SamOpportunityList,
        });
        if (!active) return;
        const first = data.items[0];
        if (!first) {
          setState(EMPTY_STATE);
          return;
        }
        setState({
          status: 'ready',
          headline: first.title ?? null,
          agency: first.agency ?? null,
          naics: first.naicsCode ?? null,
          due: first.dueDate ?? null,
          value: first.awardValue ?? null,
          category: first.category ?? null,
          link: first.uiLink ?? null,
          source: first.source ?? 'SAM',
        });
      } catch {
        if (!active) return;
        setState(EMPTY_STATE);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="rounded-xl border border-border bg-card/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-brand-600">
          <Sparkles className="size-3.5" />
          Latest micro-purchase
        </div>
        <div className="mt-2 h-5 w-3/4 rounded bg-primary/10 animate-pulse" />
        <div className="mt-2 h-4 w-1/2 rounded bg-primary/10 animate-pulse" />
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-brand-600">
          <Sparkles className="size-3.5" />
          Latest micro-purchase
        </div>
        <p className="mt-2">
          The scraper has not produced any rows yet. Hit <em>Run scrape now</em> on{' '}
          <a href="/sam" className="text-primary underline-offset-4 hover:underline">
            the Opportunities page
          </a>{' '}
          to populate this tile.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/80 p-5 shadow-sm lift">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-brand-600">
          <Sparkles className="size-3.5" />
          Latest micro-purchase
        </div>
        {state.category ? (
          <Badge variant="secondary">{state.category.replace('_', ' ')}</Badge>
        ) : null}
      </div>
      <div className="mt-2 flex items-start gap-2">
        {state.source === 'UNISON' ? (
          <Badge
            variant="default"
            className="bg-accent text-accent-foreground font-semibold tracking-wide"
          >
            Unison Global
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="font-semibold tracking-wide border-border text-muted-foreground"
          >
            SAM.gov
          </Badge>
        )}
        <h3 className="font-display text-lg font-semibold leading-snug">{state.headline}</h3>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {state.agency ? (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {state.agency}
          </span>
        ) : null}
        {state.naics ? <span>NAICS {state.naics}</span> : null}
        {state.due ? (
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            Due {dateFmt.format(new Date(state.due))}
            <DeadlineUrgencyBadge dueDate={state.due} />
          </span>
        ) : null}
        {state.value != null ? (
          <span className="font-semibold text-primary">{currencyFmt.format(state.value)}</span>
        ) : null}
      </div>
      {state.link ? (
        <a
          href={state.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open on SAM.gov
          <ArrowUpRight className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}
