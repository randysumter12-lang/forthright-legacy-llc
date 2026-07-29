// @polsia:user-owned — server component for /sam/<id>/draft. Pure composition:
// exports metadata, renders the BidDraftButton client island in a styled
// frame. NO await prisma, NO server-only imports — the island POSTs
// /api/sam-opportunities/<id>/bid-draft and reads the typed envelope back.

import { FileText, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BidDraftButton } from '@/components/custom/bid-draft-button';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Bid Draft',
  description: 'Printable Markdown bid response draft generated from the Capability Statement.',
  alternates: { canonical: '/sam' },
  openGraph: {
    title: 'Bid Draft',
    description: 'Printable Markdown bid response draft generated from the Capability Statement.',
  },
  // Draft pages are not meant to be indexed; they're deep links from the
  // detail page and the user typically lands here from /sam/<id>.
  robots: { index: false, follow: false },
};

export default async function BidDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex flex-col">
      <section className="section border-b border-border bg-muted/30">
        <div className="container-page">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/sam/${id}`}>← Back to the opportunity</Link>
          </Button>
          <span className="text-eyebrow mt-4 mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Bid Response Pipeline
          </span>
          <h1 className="font-display text-3xl xl:text-4xl font-bold tracking-tight text-balance">
            Bid Response Draft
          </h1>
          <p className="text-body-lg text-muted-foreground max-w-2xl mt-3">
            Composes a printable Markdown bid response — cover page, technical approach, staffing,
            pricing, past performance, and a simplified-acquisition compliance matrix. The draft is
            flagged <span className="font-semibold text-foreground">DRAFT</span>: a reviewer must
            approve before any future submission endpoint fires.
          </p>
          <div className="mt-4 flex items-center gap-2 text-caption text-muted-foreground">
            <FileText className="size-3.5" />
            Printable Markdown · Native print · &lt;= 5s scraped-opp → capability → draft
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container-page">
          <BidDraftButton samOpportunityId={id} />
        </div>
      </section>
    </main>
  );
}
