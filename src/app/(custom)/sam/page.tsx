// @polsia:user-owned — public read surface for the SAM.gov micro-purchase
// feed. Server Component: exports metadata, composes client islands. NO
// server-only imports, NO `await prisma`, NO `await fetch` in this file's
// body (the data plane is apiFetch). The page name `sam` is exposed at
// `/sam` because Next.js route groups (the `(custom)` parens) are layout-
// only and never appear in URLs.

import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { SamFeed } from '@/components/custom/sam-feed';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Opportunities',
  description: `Live $3,500–$10,000 federal micro-purchase feed surfaced from SAM.gov — IT services, CMMC pre-reviews, and consulting — curated daily by ${siteName}.`,
  alternates: { canonical: '/sam' },
  openGraph: {
    title: `Opportunities · ${siteName}`,
    description: siteDescription,
    url: '/sam',
  },
};

export default function SamOpportunitiesPage() {
  return (
    <main className="flex flex-col">
      <section className="section border-b border-border bg-muted/30">
        <div className="container-page">
          <span className="text-eyebrow mb-3 flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Live Opportunities · SAM.gov
          </span>
          <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight text-balance">
            Federal Micro-Purchases, Surfaced Daily
          </h1>
          <p className="text-body-lg text-muted-foreground max-w-3xl mt-3">
            Every row below is a real-time look at the simplified-acquisition band between $3,500
            and $10,000 — IT services, CMMC pre-reviews, and operational consulting. Rigel Solutions
            refreshes the feed from SAM.gov and Unison Global on a daily cron; you can also fire a
            manual run.
          </p>
        </div>
      </section>
      <section className="section" id="refresh">
        <div className="container-page">
          <SamFeed />
        </div>
      </section>
    </main>
  );
}
