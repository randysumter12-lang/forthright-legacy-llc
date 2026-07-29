// @polsia:user-owned — social-proof placeholder section for the landing page.
//
// Until case-study content is published, this section deliberately renders
// "Coming soon" placeholder cards. Pure presentational server component — no
// `'use client'`, no data plane, no server-only imports.

import { Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ProofCard {
  category: string;
  title: string;
  body: string;
}

const PLACEHOLDERS: ProofCard[] = [
  {
    category: 'Federal micro-contract capture win',
    title: 'Simplified-Acquisition Capture Win',
    body: 'Targeted IT services micro-purchase on SAM.gov, drafted and submitted under the Active Duty / Minority-Owned set-aside posture.',
  },
  {
    category: 'CMMC pre-review support',
    title: 'CMMC Pre-Review Engagement',
    body: 'Pre-November 2025 enforcement gap assessment for a DoD-adjacent contractor — sourced from a CMMC-tagged opportunity surface.',
  },
  {
    category: 'Same-day bid turnaround',
    title: 'Same-Day Bid Window Turnaround',
    body: 'A < 48-hour bid window closed on time using the Elite Concierge submission flow — covering review, packaging, and hand-off.',
  },
  {
    category: 'Set-aside positioning',
    title: 'Set-Aside Positioning Outcome',
    body: 'Award captured under the service-disabled / veteran preference after dual-status positioning was disclosed on the proposal cover sheet.',
  },
];

export function SocialProofPlaceholder() {
  return (
    <section
      id="proof"
      aria-labelledby="proof-title"
      className="section border-t border-border bg-background"
    >
      <div className="container-page">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="text-eyebrow mb-3 block">Outcomes In Progress</span>
          <h2
            id="proof-title"
            className="font-display text-3xl xl:text-h2 font-bold tracking-tight text-balance mb-4"
          >
            Wins are the proof. We&rsquo;ll publish them as they land.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Rigel Solutions is live but case studies are still being collected. Each placeholder
            below represents a category of win we&rsquo;re tracking — published here as the first
            ones close.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLACEHOLDERS.map(({ category, title, body }) => (
            <Card
              key={category}
              className="relative overflow-hidden border-border/70 shadow-sm lift"
            >
              <CardContent className="flex h-full flex-col gap-4 pt-6">
                <Badge
                  variant="secondary"
                  className="self-start gap-1.5 uppercase tracking-wider text-caption"
                >
                  <Hourglass className="size-3.5" aria-hidden />
                  Case study coming soon
                </Badge>
                <div>
                  <span className="text-caption font-semibold uppercase tracking-wider text-brand-600">
                    {category}
                  </span>
                  <h3 className="font-display mt-1 text-lg font-semibold leading-snug">{title}</h3>
                </div>
                <p className="text-small text-muted-foreground leading-relaxed">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
