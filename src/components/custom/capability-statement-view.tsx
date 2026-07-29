// @polsia:user-owned — presentational renderer for a typed Capability
// Statement. Pure props-in; no fetches, no server imports. The parent
// capability-statement-button.tsx swaps this view in below the Generate
// button once a POST round-trip succeeds (or on read-back).
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CapabilityStatement } from '@/lib/contracts/capability-statement';

const POLICY_BADGE_CLASSES: Record<string, string> = {
  'Active Duty U.S. Navy': 'border-brand text-brand-700 bg-brand-50 hover:bg-brand-100',
  'Minority-Owned': 'border-brand text-brand-700 bg-brand-50 hover:bg-brand-100',
};

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatValue(value: number | null): string {
  if (value == null) return '—';
  return currencyFmt.format(value);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

interface Props {
  data: CapabilityStatement;
}

export function CapabilityStatementView({ data }: Props) {
  const {
    cover,
    companyOverview,
    coreCompetencies,
    differentiators,
    pastPerformance,
    certifications,
    contact,
  } = data;
  const isPolicy = (badge: string) => data.policyBadges.includes(badge);

  return (
    <div className="flex flex-col gap-6" data-testid="capability-statement-view">
      {/* ── COVER ─────────────────────────────────────────────────────── */}
      <Card className="border-brand/30 bg-gradient-to-br from-brand-50 via-card to-card shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-eyebrow text-brand-700">Capability Statement</span>
              <CardTitle className="font-display text-2xl xl:text-3xl font-bold text-balance mt-1">
                {cover.companyName}
              </CardTitle>
              <p className="text-body-lg text-muted-foreground mt-2 max-w-2xl">{cover.tagline}</p>
            </div>
            <Badge variant="outline" className="border-brand text-brand-700 bg-card">
              {formatTimestamp(data.generatedAt)}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cover.badges.map((badge) => (
              <Badge
                key={badge}
                variant="outline"
                className={isPolicy(badge) ? (POLICY_BADGE_CLASSES[badge] ?? '') : 'border-border'}
              >
                {badge}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 border-t border-border pt-5">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Prepared For
            </p>
            <p className="text-body font-semibold mt-1 leading-snug">{cover.generatedFor.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {cover.generatedFor.agency} · {cover.generatedFor.noticeId}
            </p>
          </div>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              NAICS / Category
            </p>
            <p className="text-body font-semibold mt-1">{cover.generatedFor.naicsCode}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {cover.generatedFor.category.replace('_', ' ')}
            </p>
          </div>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Generated
            </p>
            <p className="text-body font-semibold mt-1">{formatTimestamp(data.generatedAt)}</p>
            <p className="text-sm text-muted-foreground mt-1">Refreshable on demand</p>
          </div>
        </CardContent>
      </Card>

      {/* ── COMPANY OVERVIEW ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-eyebrow">Company Overview</span>
          <CardTitle className="font-display text-xl mt-1">Who We Are</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-body leading-relaxed">{companyOverview.narrative}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Founded
              </p>
              <p className="text-body font-semibold mt-1">{companyOverview.founded}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Headquarters
              </p>
              <p className="text-body font-semibold mt-1">{companyOverview.headquarters}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CORE COMPETENCIES ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-eyebrow">Core Competencies</span>
          <CardTitle className="font-display text-xl mt-1">What We Deliver</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid sm:grid-cols-2 gap-4">
            {coreCompetencies.items.map((item) => (
              <li key={item.name} className="rounded-lg border border-border bg-card/80 p-4 lift">
                <h3 className="font-semibold text-body leading-snug">{item.name}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── DIFFERENTIATORS ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-eyebrow">Differentiators</span>
          <CardTitle className="font-display text-xl mt-1">Why Us, Why Now</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {differentiators.items.map((line) => (
              <li
                key={line}
                className="flex gap-3 text-body leading-relaxed rounded-md border-l-2 border-brand bg-brand-50/40 pl-4 py-2"
              >
                <span aria-hidden className="text-brand-700 font-bold select-none">
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── PAST PERFORMANCE ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-eyebrow">Past Performance</span>
          <CardTitle className="font-display text-xl mt-1">Relevant Track Record</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-4">
            {pastPerformance.items.map((entry) => (
              <li
                key={`${entry.client}-${entry.period}`}
                className="rounded-lg border border-border bg-card/80 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-body leading-snug">{entry.client}</h3>
                  <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                    {entry.period}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{entry.scope}</p>
                <p className="text-sm text-foreground mt-3">
                  <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground mr-2">
                    Value
                  </span>
                  {formatValue(entry.value)}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── CERTIFICATIONS ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-eyebrow">Certifications & NAICS</span>
          <CardTitle className="font-display text-xl mt-1">Set-Aside Positioning</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              NAICS Codes
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {certifications.naics.map((code) => (
                <Badge key={code} variant="secondary">
                  {code}
                </Badge>
              ))}
            </div>
          </div>
          {certifications.certifications.length > 0 ? (
            <div>
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Certifications
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {certifications.certifications.map((cert) => (
                  <li key={cert}>
                    <Badge variant="outline" className="border-brand text-brand-700 bg-brand-50">
                      {cert}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {certifications.setAside.length > 0 ? (
            <div>
              <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                Set-Aside Eligibility
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {certifications.setAside.map((sa) => (
                  <li key={sa}>
                    <Badge variant="outline" className="border-brand text-brand-700 bg-brand-50">
                      {sa}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── CONTACT ──────────────────────────────────────────────────── */}
      <Card className="border-brand/30 bg-brand-50/30">
        <CardHeader>
          <span className="text-eyebrow text-brand-700">Point of Contact</span>
          <CardTitle className="font-display text-xl mt-1">Reach the Bid Team</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </p>
            <p className="text-body font-semibold mt-1">{contact.name}</p>
          </div>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </p>
            <a
              href={`mailto:${contact.email}`}
              className="text-body font-semibold mt-1 text-primary underline-offset-4 hover:underline block"
            >
              {contact.email}
            </a>
          </div>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Phone
            </p>
            <p className="text-body font-semibold mt-1">{contact.phone}</p>
          </div>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Website
            </p>
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body font-semibold mt-1 text-primary underline-offset-4 hover:underline block truncate"
            >
              {contact.website}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
