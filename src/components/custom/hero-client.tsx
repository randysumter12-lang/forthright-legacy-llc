'use client';

import { ArrowDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function NavySealBadge() {
  return (
    <svg
      role="img"
      aria-label="Founder holds Active Duty U.S. Navy status"
      viewBox="0 0 64 64"
      className="size-12 shrink-0"
    >
      <title>Active Duty U.S. Navy</title>
      <defs>
        <linearGradient id="navy-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-700)" />
          <stop offset="100%" stopColor="var(--brand-900)" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="url(#navy-fill)"
        stroke="var(--accent)"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.4"
        strokeWidth="0.75"
      />
      {/* Anchor */}
      <path
        d="M32 16 v22 M22 38 q0 7 10 7 q10 0 10 -7"
        stroke="var(--accent)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="32" cy="20" r="2" fill="var(--accent)" />
      <path d="M28 22 h8" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M26 38 q-6 4 -10 4"
        stroke="var(--accent)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M38 38 q6 4 10 4"
        stroke="var(--accent)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Stars */}
      <text
        x="32"
        y="56"
        textAnchor="middle"
        fontSize="3.2"
        fontWeight="700"
        letterSpacing="0.18em"
        fill="var(--accent)"
      >
        U · S · N
      </text>
    </svg>
  );
}

function MinorityOwnedSeal() {
  return (
    <svg
      role="img"
      aria-label="Founder's firm holds SBA-verified Minority-Owned small business status"
      viewBox="0 0 64 64"
      className="size-12 shrink-0"
    >
      <title>SBA Minority-Owned Status</title>
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="var(--accent)"
        stroke="var(--brand-700)"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="var(--brand-700)"
        strokeOpacity="0.55"
        strokeWidth="0.75"
      />
      {/* Outer ring text (cosmetics — letter-spaced characters around the seal) */}
      <text
        x="32"
        y="13"
        textAnchor="middle"
        fontSize="3.6"
        fontWeight="800"
        letterSpacing="0.32em"
        fill="var(--brand-900)"
      >
        SBA
      </text>
      {/* Crest shield */}
      <path
        d="M32 18 l10 5 v8 q0 9 -10 14 q-10 -5 -10 -14 v-8 z"
        fill="var(--brand-900)"
        stroke="var(--brand-700)"
        strokeWidth="1"
      />
      <text x="32" y="34" textAnchor="middle" fontSize="6" fontWeight="800" fill="var(--accent)">
        MBE
      </text>
      <text
        x="32"
        y="56"
        textAnchor="middle"
        fontSize="3"
        fontWeight="700"
        letterSpacing="0.2em"
        fill="var(--brand-900)"
      >
        VERIFIED
      </text>
    </svg>
  );
}

export function HeroClient() {
  return (
    <section className="section-lg">
      <div className="container-page">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-6">
            <span className="text-eyebrow">
              Rigel · Active Duty U.S. Navy · Minority-Owned SBA · Set-Aside Ready
            </span>

            {/* Inline credential badge cluster */}
            <div className="flex items-center gap-4">
              <div className="credentials-badge-ring flex items-center gap-3 rounded-md border border-brand-700/40 bg-card/70 px-3 py-2">
                <NavySealBadge />
                <span className="text-small font-semibold uppercase tracking-wider text-foreground">
                  Randy
                  <br />
                  Active Duty U.S. Navy
                </span>
              </div>
              <div className="credentials-badge-ring flex items-center gap-3 rounded-md border border-brand-700/40 bg-card/70 px-3 py-2">
                <MinorityOwnedSeal />
                <span className="text-small font-semibold uppercase tracking-wider text-foreground">
                  SBA-Verified
                  <br />
                  Minority-Owned
                </span>
              </div>
            </div>

            <h1 className="font-display text-5xl xl:text-h1 font-bold tracking-tight leading-[1.06] text-balance">
              We find and draft your next federal micro-contract —{' '}
              <span className="text-primary">automatically.</span>
            </h1>
            <p className="text-body-lg text-muted-foreground leading-relaxed max-w-xl">
              Rigel Solutions monitors SAM.gov and Unison Global daily for $3,500–$10,000
              simplified-acquisition buys in IT services, CMMC cybersecurity, and consulting. Every
              qualified drop arrives with a ready-to-review bid draft — so the only decision you
              make is <em>submit</em>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild>
                <Link href="/#pricing">
                  Start Winning
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sam">Browse the live feed</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <a href="/#how-it-works">
                  See how it works
                  <ArrowDown className="size-4" />
                </a>
              </Button>
            </div>

            {/* Outcome micro-stat strip */}
            <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-md border border-border/60 bg-card/40 px-5 py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-h3 font-bold text-primary leading-none">8+</span>
                <span className="text-small text-muted-foreground">wins / month target</span>
              </div>
              <div className="silver-divider h-6 w-px" aria-hidden />
              <div className="flex items-baseline gap-2">
                <span className="font-display text-h3 font-bold text-primary leading-none">
                  ≈ $62,500
                </span>
                <span className="text-small text-muted-foreground">/ month gross</span>
              </div>
            </div>
          </div>

          {/* Right: velocity grid (kept from previous design, paired with a tight credential strip) */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-sm">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-accent/5 border border-border" />
              <div className="absolute top-6 left-0 right-0 flex flex-col gap-3">
                {['w-100', 'w-[70%]', 'w-100', 'w-[50%]', 'w-[85%]'].map((cls) => (
                  <div
                    key={cls}
                    className={`h-px rounded-full bg-gradient-to-r from-primary/40 via-primary/20 to-transparent ${cls}`}
                  />
                ))}
              </div>
              <div className="absolute top-0 right-8 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
              <div className="relative z-10 mt-16 mb-8 space-y-4 px-6">
                <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                        IT Services
                      </span>
                      <span className="text-sm font-medium text-card-foreground leading-snug">
                        Network Infrastructure Upgrade — VA Regional Office
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Solicitation #36C10X-24-Q-0047
                      </span>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 shrink-0">
                      $8,500
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                        CMMC Pre-Review
                      </span>
                      <span className="text-sm font-medium text-card-foreground leading-snug">
                        Cybersecurity Gap Assessment — DISA Adjacent
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Solicitation #HCI04X-24-R-0012
                      </span>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 shrink-0">
                      $9,200
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                        Consulting
                      </span>
                      <span className="text-sm font-medium text-card-foreground leading-snug">
                        Process Optimization Study — FEMA Zone 4
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Solicitation #70CDT8-25-Q-0091
                      </span>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 shrink-0">
                      $7,800
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-bold text-primary">8+</span>
                  <span className="text-xs text-muted-foreground">Wins / Month</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-bold text-primary">$7.8K</span>
                  <span className="text-xs text-muted-foreground">Avg Award</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-bold text-primary">30s</span>
                  <span className="text-xs text-muted-foreground">Draft Latency</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
