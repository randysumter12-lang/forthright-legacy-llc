// @polsia:user-owned — dashboard home island.
//
// Tier-aware landing card for the dashboard. Pulls /api/billing/subscription
// once, then renders Starter / Professional / Elite panels — each panel is
// a different feature surface, exactly the value the brief asks for:
//   - Starter: opportunity browser only
//   - Professional: + bid-draft / capability buttons
//   - Elite: + Concierge channel tile

'use client';

import {
  ArrowUpRight,
  CircleDollarSign,
  Compass,
  FileText,
  Headphones,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { QualifyingThisWeekWidget } from '@/components/custom/dashboard/qualifying-this-week-widget';
import { TodaysBidQueue } from '@/components/custom/dashboard/todays-bid-queue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { SubscriptionEnvelope, type Tier } from '@/lib/contracts/subscription';
import { cn } from '@/lib/utils';

const TIER_NAME: Record<Tier, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ELITE: 'Elite / Concierge',
};

const TIER_BLURB: Record<Tier, string> = {
  STARTER:
    'Daily SAM.gov micro-purchase feed. Capability statements on demand. Single monthly bid draft.',
  PROFESSIONAL:
    'Full autonomy. Unlimited AI bid drafts, set-aside positioning, autonomous daily refresh.',
  ELITE:
    'Concierge delivery. Dedicated channel, hand-crafted capability statements, same-day turnaround.',
};

const TIER_BADGE_VARIANT: Record<Tier, 'secondary' | 'default'> = {
  STARTER: 'secondary',
  PROFESSIONAL: 'default',
  ELITE: 'default',
};

interface FeatureRow {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  cta?: { href: string; label: string };
}

function featureForTier(tier: Tier): FeatureRow[] {
  const rows: FeatureRow[] = [
    {
      icon: Compass,
      label: 'Live SAM.gov feed',
      description: 'Browse and filter the daily $3.5K–$10K micro-purchase drop.',
      cta: { href: '/sam', label: 'Open feed' },
    },
  ];
  if (tier === 'PROFESSIONAL' || tier === 'ELITE') {
    rows.push({
      icon: FileText,
      label: 'Bid drafting',
      description: 'AI-generated bid drafts on every qualified opportunity, unlimited.',
      cta: { href: '/sam', label: 'Generate drafts' },
    });
  }
  if (tier === 'ELITE') {
    rows.push({
      icon: Headphones,
      label: 'Concierge channel',
      description: 'Same-day escalation, hand-crafted capability statements.',
      cta: { href: '#concierge', label: 'Open Concierge' },
    });
  }
  // Starter-only row to make the difference concrete.
  if (tier === 'STARTER') {
    rows.push({
      icon: ScrollText,
      label: 'Capability statements',
      description: 'Generate one capability statement per opportunity.',
      cta: { href: '/sam', label: 'Browse opportunities' },
    });
  }
  return rows;
}

export function DashboardHome() {
  const [state, setState] = React.useState<
    { status: 'loading' } | { status: 'ready'; tier: Tier; cancelAtPeriodEnd: boolean }
  >({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const env = await apiFetch('/api/billing/subscription', {
          schema: SubscriptionEnvelope,
        });
        if (cancelled) return;
        if (env.active && env.subscription) {
          setState({
            status: 'ready',
            tier: env.subscription.tier,
            cancelAtPeriodEnd: env.subscription.cancelAtPeriodEnd,
          });
        } else {
          // The dashboard gate already bounced with no subscription; this
          // branch is defensive — render Starter as the floor.
          setState({ status: 'ready', tier: 'STARTER', cancelAtPeriodEnd: false });
        }
      } catch {
        if (cancelled) return;
        setState({ status: 'ready', tier: 'STARTER', cancelAtPeriodEnd: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-gutter py-section">
        <p className="text-small text-muted-foreground">Loading your dashboard…</p>
      </main>
    );
  }

  return (
    <div className="grid gap-6">
      <QualifyingThisWeekWidget />
      <Card className="overflow-hidden border-border/70 shadow-brand">
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--accent)]/50" aria-hidden />
        <CardContent className="flex flex-col gap-4 p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow">Active plan</p>
              <h1 className="font-display text-h1 text-foreground tracking-tight">
                {TIER_NAME[state.tier]}
              </h1>
              <p className="mt-2 max-w-2xl text-body text-muted-foreground">
                {TIER_BLURB[state.tier]}
              </p>
            </div>
            <Badge variant={TIER_BADGE_VARIANT[state.tier]} className="uppercase">
              {TIER_NAME[state.tier]}
            </Badge>
          </div>
          {state.cancelAtPeriodEnd ? (
            <p className="rounded-md border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-small text-amber-200">
              Auto-renew is OFF — your access is active until the period ends. Re-subscribe any time
              before then.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link href="/dashboard/billing">Manage subscription</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">View plans</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        {featureForTier(state.tier).map((row, idx) => {
          const Icon = row.icon;
          return (
            <Card
              key={row.label}
              className={cn(
                'border-border/70 shadow-sm transition-shadow hover:shadow-md',
                idx === 0 ? 'lg:col-span-1' : '',
              )}
            >
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <div className="flex size-10 items-center justify-center rounded-md bg-brand-700/15 text-brand-400">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-display text-h4 tracking-tight text-foreground">{row.label}</h3>
                <p className="text-small text-muted-foreground">{row.description}</p>
                {row.cta ? (
                  <div className="mt-auto pt-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={row.cta.href}>
                        {row.cta.label}
                        <ArrowUpRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TodaysBidQueue />

        <div className="flex flex-col gap-4">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">Today&apos;s SAM.gov surface</p>
                  <h3 className="font-display text-h3 tracking-tight text-foreground">
                    Today&apos;s micro-purchase window
                  </h3>
                  <p className="mt-1 text-small text-muted-foreground">
                    Open the live feed to see what scraped this morning. Tier-appropriate actions
                    appear on each opportunity detail.
                  </p>
                </div>
                <CircleDollarSign className="size-6 text-[var(--accent)]" aria-hidden />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/sam">
                    Open live feed
                    <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="text-eyebrow">Access posture</p>
              <ul className="grid gap-2 text-small text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[var(--accent)]" aria-hidden /> Authenticated
                </li>
                <li className="flex items-center gap-2">
                  <CircleDollarSign className="size-4 text-[var(--accent)]" aria-hidden />{' '}
                  Subscription: {TIER_NAME[state.tier]}
                </li>
                <li className="flex items-center gap-2">
                  <Compass className="size-4 text-[var(--accent)]" aria-hidden /> Auto-renew:{' '}
                  <span className="font-medium text-foreground">
                    {state.cancelAtPeriodEnd ? 'OFF (period ends)' : 'ON'}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
