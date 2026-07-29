// @polsia:user-owned — landing page served at /. Server component: exports
// metadata, composes client islands (HeroClient, PricingTable, SamLatestTile,
// CheckoutButton) and a few pure presentational server sections. NO
// `await prisma`, NO `await fetch`, NO server-only imports, NO secret reads.

import { Bot, CheckCircle2, GlobeLock, Mail } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CredentialsBand } from '@/components/custom/credentials-band';
import { HeroClient } from '@/components/custom/hero-client';
import { OutcomeStrip } from '@/components/custom/outcome-strip';
import { CheckoutButton } from '@/components/custom/pricing/checkout-button';
import { PricingTable, type PricingTableProps } from '@/components/custom/pricing/pricing-table';
import { SamLatestTile } from '@/components/custom/sam-latest-tile';
import { SocialProofPlaceholder } from '@/components/custom/social-proof-placeholder';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
};

// ─── How It Works ────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    icon: GlobeLock,
    title: 'Surface Opportunities Daily',
    body: 'Our AI continuously monitors SAM.gov and Unison Global to identify IT services, CMMC-related cybersecurity pre-reviews, and operational consulting contracts that match your capabilities and set-aside eligibility.',
  },
  {
    num: '02',
    icon: Bot,
    title: 'Auto-Generate Bid Documents',
    body: 'For every qualified opportunity, the platform auto-generates a professional Capability Statement and a tailored bid response — ready for human review before submission.',
  },
  {
    num: '03',
    icon: CheckCircle2,
    title: 'Submit & Win',
    body: 'You review the generated documents, make any final adjustments, and submit. Our set-aside positioning leverages your Minority-Owned status and Active Duty affiliation for preferential treatment.',
  },
];

// ─── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'What contract types and values does Rigel Solutions target?',
    a: 'We focus exclusively on U.S. Federal micro-purchases (simplified acquisitions between $3,500 and $10,000) sourced from SAM.gov and Unison Global — covering IT services, CMMC-related cybersecurity pre-reviews, and operational consulting. This segment issued over 560,000 awards last year and is expanding by approximately 50,000 new opportunities annually.',
  },
  {
    q: 'How does the AI identify and qualify opportunities?',
    a: 'The platform scours SAM.gov and Unison Global daily, applying natural language understanding to solicitation documents, SOWs, and QA specifications. It matches opportunities against your capabilities and filters for set-aside eligibility, probability of award, and fit with our target categories — surfacing only high-probability, high-fit buys.',
  },
  {
    q: 'What is CMMC and why does the November 2025 enforcement date matter?',
    a: 'The Cybersecurity Maturity Model Certification (CMMC) is a DoD framework that requires contractors to meet specific cybersecurity standards. With enforcement beginning November 2025, any organization bidding on affected contracts must demonstrate compliance — creating a surge of demand for CMMC pre-reviews and gap assessments that Rigel Solutions is uniquely positioned to address.',
  },
  {
    q: 'How does the Minority-Owned and Active Duty status affect my chances?',
    a: 'Federal regulations reserve a percentage of micro-purchases for Minority-Owned small businesses, and companies led by Active Duty or Veteran service members receive additional preference consideration. Randy’s dual status in both categories gives Rigel Solutions preferential positioning in a wide range of set-aside buys.',
  },
  {
    q: 'Who reviews the AI-generated bid documents before submission?',
    a: 'You do. Every document the platform generates is placed in a human review queue for final approval before submission. We believe human oversight is essential for compliance, tone, and competitive nuance — the AI handles the volume and first draft, you handle the judgment call.',
  },
  {
    q: 'Can I upgrade, downgrade, or cancel at any time?',
    a: 'Yes. Each tier is a single monthly Stripe charge — no contracts, no per-bid fees. Cancel from your dashboard and you keep access through the end of the paid month. To upgrade, simply check out at the next tier.',
  },
];

// SSR-safe tier catalog for the in-page pricing band — mirrors the static
// marketing shape used by /pricing so the band paints before the client fetch.
const PRICING_INITIAL_TIERS: PricingTableProps['initialTiers'] = [
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

// ─── Sections ─────────────────────────────────────────────────────────────────

function PricingBand() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-band-title"
      className="section border-t border-border bg-card/40"
    >
      <div className="container-page">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <span className="text-eyebrow mb-3 block">Pricing</span>
          <h2
            id="pricing-band-title"
            className="font-display text-3xl xl:text-h2 font-bold tracking-tight text-balance mb-4"
          >
            Three tiers. Pick the runway that fits how much you want to draft yourself.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Every plan is a single monthly Stripe charge. The full plan detail — comparison, refund
            terms, security posture — lives on{' '}
            <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
              the pricing page
            </Link>
            .
          </p>
        </div>
        <PricingTable initialTiers={PRICING_INITIAL_TIERS} compact />
      </div>
    </section>
  );
}

function LatestOpportunitiesSection() {
  return (
    <section id="latest" className="section border-t border-border bg-muted/30">
      <div className="container-page">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <span className="text-eyebrow mb-3 block">Live &amp; Updated Daily</span>
            <h2 className="font-display text-3xl xl:text-4xl font-bold tracking-tight mb-4">
              See What the Scraper Surfaced Today
            </h2>
            <p className="text-body-lg text-muted-foreground leading-relaxed mb-6 max-w-xl">
              The Opportunities page is a daily cron-driven feed of $3,500–$10,000 simplified-
              acquisition listings on SAM.gov: IT services, CMMC pre-reviews, consulting. Hit the
              manual trigger to test it without waiting for the morning job.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild>
                <Link href="/sam">Open the live feed</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="/sam#refresh">Run scrape now</Link>
              </Button>
            </div>
          </div>
          <div className="justify-self-stretch">
            <SamLatestTile />
          </div>
        </div>
      </div>
    </section>
  );
}

function ConversionCTA() {
  return (
    <section
      id="contact"
      aria-labelledby="conversion-title"
      className="section-lg bg-card border-t border-border"
    >
      <div className="container-page text-center">
        <Badge variant="secondary" className="mb-4 uppercase tracking-wider">
          Rigel · Elite · Concierge
        </Badge>
        <h2
          id="conversion-title"
          className="font-display text-4xl xl:text-h1 font-bold tracking-tight text-balance mb-4"
        >
          Go Elite on every bid window.
        </h2>
        <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          The $1,500/mo Elite tier puts a Concierge team on standby for every bid window — same-day
          turnaround on &lt; 48h solicitations, hand-crafted capability statements, and quarterly
          federal-market posture review. Step back to Professional at $495/mo when you still want
          full autonomous drafting but don&rsquo;t need concierge, or start with Starter at $95/mo
          to test the daily feed.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto">
          <CheckoutButton
            tier="STARTER"
            variant="outline"
            size="lg"
            label="Start with Starter"
            priceLabel="$95/mo"
            className="h-auto min-h-[3.5rem] py-4 whitespace-normal"
          />
          <CheckoutButton
            tier="PROFESSIONAL"
            size="lg"
            label="Choose Professional"
            priceLabel="$495/mo"
            className="h-auto min-h-[3.5rem] py-4 whitespace-normal shadow-brand"
          />
          <CheckoutButton
            tier="ELITE"
            variant="secondary"
            size="lg"
            label="Go Elite — $1,500/mo"
            priceLabel=""
            className="h-auto min-h-[3.5rem] py-4 whitespace-normal"
          />
        </div>

        <p className="mt-8 text-small text-muted-foreground">
          New here? You&rsquo;ll be asked to confirm an account before checkout — no charge until
          you approve the Stripe window. Questions? Email{' '}
          <a
            href="mailto:rigel-solutions@polsia.io"
            className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
          >
            <Mail className="size-3.5" aria-hidden />
            rigel-solutions@polsia.io
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="section border-t border-border">
      <div className="container-page">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <span className="text-eyebrow mb-3 block">The Process</span>
          <h2 className="font-display text-3xl xl:text-4xl font-bold tracking-tight">
            From opportunity to submitted bid in three steps.
          </h2>
          <p className="text-body-lg text-muted-foreground mt-4">
            The platform handles the volume and first draft. You handle the judgment call.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map(({ num, icon: Icon, title, body }) => (
            <Card key={num} className="relative overflow-hidden lift">
              <CardContent className="flex h-full flex-col gap-4 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <span className="text-4xl font-bold text-primary/20 font-display">{num}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg leading-snug mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="section border-t border-border">
      <div className="container-page">
        <div className="text-center mb-12">
          <span className="text-eyebrow mb-3 block">Common Questions</span>
          <h2 className="font-display text-3xl xl:text-4xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map(({ q, a }) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left font-medium">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="flex flex-col">
      {/* Hero — client island, fetches nothing yet, server-renders statically */}
      <HeroClient />

      {/* Credentials band — static presentational, sets up trust before the funnel */}
      <CredentialsBand />

      {/* How It Works — underscores the volume strategy */}
      <HowItWorks />

      {/* Pricing band — three tiers, Professional highlighted */}
      <PricingBand />

      {/* Outcome strip — projected run-rate, argues for Professional */}
      <OutcomeStrip />

      {/* Social-proof placeholder — case studies tracked, published as wins close */}
      <SocialProofPlaceholder />

      {/* Live SAM feed teaser — proves the cron is alive */}
      <LatestOpportunitiesSection />

      {/* FAQ — answers the objection cycle before the final ask */}
      <FAQ />

      {/* Tier signup CTA — replaces the old mailto ContactCTA */}
      <ConversionCTA />
    </main>
  );
}
