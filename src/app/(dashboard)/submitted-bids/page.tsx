// @polsia:user-owned — server component for /submitted-bids. Pure composition:
// exports metadata, renders the SubmittedBidsTable client island in a styled
// section. NO `await prisma`, NO server-only imports — every datum (rows,
// timestamps, badge text) flows from the client island's GET /api/bids
// call. Auth gate is inherited from the parent (dashboard)/layout.tsx
// (DashboardShell redirects unauthenticated visitors to /login).

import type { Metadata } from 'next';
import { SubmittedBidsDownloadButton } from '@/components/custom/submitted-bids-download-button';
import { SubmittedBidsTable } from '@/components/custom/submitted-bids-table';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Submitted bids',
  description: `Every bid you've shipped on ${siteName}, with submission timestamps and audit counts.`,
  alternates: { canonical: '/submitted-bids' },
  // Internal-only page — a list of personalized submissions shouldn't be
  // indexed even when the deploy is broadly indexable.
  robots: { index: false, follow: false },
};

export default function SubmittedBidsPage() {
  return (
    <section aria-label="Submitted bids" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Submission registry</p>
          <h1 className="font-display text-h1 font-bold tracking-tight">Submitted bids</h1>
          <p className="mt-2 max-w-2xl text-body text-muted-foreground">
            Every bid you&apos;ve shipped, with submission audit counts.
          </p>
        </div>
        <SubmittedBidsDownloadButton />
      </header>
      <SubmittedBidsTable />
    </section>
  );
}
