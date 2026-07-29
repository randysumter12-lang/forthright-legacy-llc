// @polsia:user-owned — pricing/plan selection page.
//
// Server component (exports metadata, no client-only fetches). Composes the
// pricing gate, the three-tier table, and explanatory copy. Anonymous and
// Starter visitors see the table; Professional/Elite subscribers auto-route
// to /dashboard.

import { Lock, ScrollText, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { PricingGate } from '@/components/custom/pricing/pricing-gate';
import { PricingTable, type PricingTableProps } from '@/components/custom/pricing/pricing-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Three subscription tiers for the Rigel Solutions federal micro-purchase platform: Starter, Professional, Elite / Concierge.`,
  alternates: { canonical: '/pricing' },
};

// Initial SSR catalog so the table paints before the client fetch lands; the
// static client island revalidates via /api/pricing for live consistency.
const INITIAL_TIERS: PricingTableProps['initialTiers'] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    headline: 'Surface the federal micro-purchase market.',
    description: '',
    amountUsd: 95,
    interval: 'per month',
    badge: '',
    features: [
      'Daily SAM.gov + Unison Global micro-purchase feed ($3.5K–$10K)',
      'Set-aside + category filters',
      'Opportunity detail view + Capability Statement generator',
      'Manual bid drafting — one opportunity per month',
      'Email digest of new opportunities',
    ],
  },
  {
    tier: 'PROFESSIONAL',
    name: 'Professional',
    headline: 'Full autonomy — identify, draft, package, deliver.',
    description: '',
    amountUsd: 495,
    interval: 'per month',
    badge: 'Most selected',
    features: [
      'Everything in Starter',
      'Unlimited AI-generated bid drafts',
      'Set-aside positioning (Minority-Owned + Active Duty)',
      'Daily autonomous SAM.gov + Unison Global refresh job',
      'Polished proposal formatting — ready for human review',
      'Status tracking across the bid pipeline',
    ],
  },
  {
    tier: 'ELITE',
    name: 'Elite / Concierge',
    headline: 'Concierge delivery — your proposal team on standby.',
    description: '',
    amountUsd: 1500,
    interval: 'per month',
    badge: 'Concierge',
    features: [
      'Everything in Professional',
      'Dedicated Concierge escalation channel',
      'Hand-crafted capability statements (CMMC pre-reviews included)',
      'Same-day turnaround on bid windows < 48h',
      'Submission-day support + post-award handoff',
      'Quarterly federal-market posture review',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="flex flex-col bg-background text-foreground">
      {/* ── Header strip ─────────────────────────────────────────── */}
      <section className="section border-b border-border bg-card/40">
        <div className="container-page text-center">
          <Badge variant="secondary" className="mb-4 uppercase tracking-wider">
            Pricing · {siteName}
          </Badge>
          <h1 className="mx-auto max-w-3xl font-display text-h1 font-bold tracking-tight text-balance">
            Three Plans. Built for the federal micro-purchase window.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-body-lg text-muted-foreground">
            Each plan is a single monthly charge — no per-bid fees, no contracts. Upgrade or cancel
            at period end from your dashboard.
          </p>
          <ul className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-small text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--accent)]" aria-hidden /> Hosted by Stripe.
            </li>
            <li className="flex items-center gap-2">
              <Lock className="size-4 text-[var(--accent)]" aria-hidden /> Encrypted at every layer.
            </li>
            <li className="flex items-center gap-2">
              <ScrollText className="size-4 text-[var(--accent)]" aria-hidden /> Cancel any time.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Plan grid (gate + table) ─────────────────────────────── */}
      <section className="section-lg bg-background">
        <div className="container-page">
          <PricingGate>
            <PricingTable initialTiers={INITIAL_TIERS} />
          </PricingGate>
        </div>
      </section>

      {/* ── Trust card ─────────────────────────────────────────── */}
      <section className="section border-t border-border bg-card/40">
        <div className="container-page">
          <Card className="mx-auto max-w-3xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-7 text-center">
              <p className="text-eyebrow">Security &amp; Posture</p>
              <h2 className="font-display text-h3 tracking-tight">
                Designed for federal contracting — built to that standard.
              </h2>
              <p className="text-body text-muted-foreground">
                We don&apos;t store payment cards directly — checkout is hosted by Stripe and your
                data flows through signed, encrypted channels. Every account is better-auth
                session-backed with optional admin role escalation for the owner.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
