// @polsia:user-owned — credentials band for the landing page. Three badge
// cards + a founder credibility narrative. Pure presentational server
// component — no `'use client'`, no fetch, no server-only imports.

import { Anchor, BadgeCheck, type LucideIcon, ShieldCheck } from 'lucide-react';

interface CredentialCard {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
}

const CREDENTIALS: CredentialCard[] = [
  {
    icon: Anchor,
    label: 'Founder · Active Duty U.S. Navy',
    title: 'Active Duty U.S. Navy',
    body: 'Rigel is led by Randy — an Active Duty U.S. Navy servicemember — directly invoking the service-disabled / veteran set-aside preferences reserved for federal micro-purchases.',
  },
  {
    icon: BadgeCheck,
    label: 'SBA Verified · MBE',
    title: 'Minority-Owned SBA Verified',
    body: 'SBA-verified Minority-Owned small business. Triggers the price-evaluation preference on minority-eligible buys and unlocks the dedicated set-aside pool federal buyers must reach each year.',
  },
  {
    icon: ShieldCheck,
    label: 'Set-Aside Eligible',
    title: 'Set-Aside Eligible',
    body: "Every bid Rigel Solutions generates carries the firm's preferred-status disclosure in the cover sheet — no last-minute paperwork, no missed preference checkboxes at award.",
  },
];

export function CredentialsBand() {
  return (
    <section
      id="credentials"
      aria-labelledby="credentials-title"
      className="section border-t border-border bg-muted/40"
    >
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14 items-start">
          {/* Founder credibility narrative */}
          <div className="flex flex-col gap-4">
            <span className="text-eyebrow">Founder Credentials</span>
            <h2
              id="credentials-title"
              className="font-display text-3xl xl:text-h2 font-bold tracking-tight text-balance"
            >
              Built by a founder with{' '}
              <span className="text-primary">two real set-aside statuses</span> — not a marketing
              persona.
            </h2>
            <p className="text-body-lg text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Meet Randy.</span> Rigel Solutions was
              founded by Randy, an Active Duty U.S. Navy servicemember who also qualifies under the
              SBA Minority-Owned small business designation. Federal micro-purchase regulations
              reward both statuses with price-evaluation preferences on the buys where they apply —
              preferences that this platform operationalizes on every bid it drafts.
            </p>
            <p className="text-body text-muted-foreground leading-relaxed">
              That means each submitted bid carries dual-status positioning by default,
              Randy&rsquo;s CMMC-era defensive-cybersecurity expertise informs the firm&rsquo;s
              category filters, and federal buyers see a credible, current status disclosure on
              every cover sheet.
            </p>
          </div>

          {/* Three badge cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CREDENTIALS.map(({ icon: Icon, label, title, body }) => (
              <article
                key={title}
                className="credentials-badge-ring flex flex-col gap-3 rounded-md border border-border/80 bg-card p-5 shadow-sm lift"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <span className="text-caption font-semibold uppercase tracking-wider text-brand-600">
                    {label}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold leading-snug">{title}</h3>
                <p className="text-small text-muted-foreground leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
