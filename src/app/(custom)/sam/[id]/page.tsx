// @polsia:user-owned — server component for /sam/<id>. Pure composition:
// exports metadata, renders <SamDetail /> client island. NO await prisma,
// NO server-only imports — the island fetches through /api.

import { FileText, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SamDetail } from '@/components/custom/sam-detail';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Opportunity Detail',
  description: 'Tailored Capability Statement generator for SAM.gov micro-purchase opportunities.',
  alternates: { canonical: '/sam' },
  openGraph: {
    title: 'Opportunity Detail',
    description:
      'Tailored Capability Statement generator for SAM.gov micro-purchase opportunities.',
  },
  // Detail pages are not meant to be indexed externally (they are deep links
  // from the live feed); keep them out of the crawl surface.
  robots: { index: false, follow: false },
};

export default async function SamOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="flex flex-col">
      <section className="section border-b border-border bg-muted/30">
        <div className="container-page">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sam">← Back to the live feed</Link>
          </Button>
          <span className="text-eyebrow mt-4 mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Capability Pipeline
          </span>
          <h1 className="font-display text-3xl xl:text-4xl font-bold tracking-tight text-balance">
            Generate the Capability Statement
          </h1>
          <p className="text-body-lg text-muted-foreground max-w-2xl mt-3">
            One click composes a tailored Capability Statement for this SAM.gov opportunity using
            the founder's Active Duty U.S. Navy + Minority-Owned profile and saves it for audit.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container-page flex flex-col gap-8">
          <SamDetail samOpportunityId={id} />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-5">
            <div>
              <span className="text-eyebrow text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5" />
                Bid Response Pipeline
              </span>
              <p className="text-body mt-1 leading-relaxed max-w-2xl text-balance">
                Once a Capability Statement is on file, generate a printable Markdown bid response
                draft. Status flag is <span className="font-semibold text-foreground">DRAFT</span>{' '}
                until a reviewer approves — programmer cannot self-promote to SUBMITTED.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/sam/${id}/draft`}>View bid draft →</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
