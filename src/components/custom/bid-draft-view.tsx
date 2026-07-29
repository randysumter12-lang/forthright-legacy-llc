// @polsia:user-owned — presentational renderer for a typed Bid Draft. Renders
// the printable Markdown string inside a styled <article> + ships a native
// `window.print()` button so the bidder can drop the draft straight onto
// paper or PDF via the browser's print dialog. Pure props-in; no fetches.
'use client';

import { Download, Printer } from 'lucide-react';
import { BidDraftApproveButton } from '@/components/custom/bid-draft-approve-button';
import { BidDraftAuditRow } from '@/components/custom/bid-draft-audit-row';
import { BidDraftSubmitButton } from '@/components/custom/bid-draft-submit-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BidDraftResult } from '@/lib/contracts/bid-draft';

interface Props {
  data: BidDraftResult;
  onTransitioned?: () => void;
}

function handlePrint() {
  // Pure native print — the article DOM already has the canonical Markdown.
  if (typeof window !== 'undefined') window.print();
}

function handleDownload(markdown: string, filename: string) {
  // Trivial Markdown text download so the bidder can hand the .md file off.
  if (typeof window === 'undefined') return;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BidDraftView({ data, onTransitioned }: Props) {
  const { draft } = data;
  const source = data.source ?? 'SAM';
  const { status, revision, generatedAt, updatedAt, markdown, sections } = draft;
  const { cover } = sections;
  const noticeId = cover.noticeId || draft.samOpportunityId;
  const filename = `bid-draft-${noticeId.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
  const updated = updatedAt === generatedAt ? 'just now' : `${revision} prior revision(s)`;

  return (
    <div className="flex flex-col gap-6" data-testid="bid-draft-view">
      <Card className="border-brand/30 bg-gradient-to-br from-brand-50 via-card to-card shadow-md print:shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-eyebrow text-brand-700">Bid Response Draft</span>
              <CardTitle className="font-display text-2xl xl:text-3xl font-bold text-balance mt-1">
                {cover.title}
              </CardTitle>
              <p className="text-body-lg text-muted-foreground mt-2 max-w-2xl">{cover.tagline}</p>
            </div>
            <Badge
              variant="outline"
              className="border-brand text-brand-700 bg-card font-semibold tracking-wide"
            >
              Status: {status}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="font-mono">
              {noticeId}
            </Badge>
            <Badge variant="secondary">{cover.agency}</Badge>
            <Badge variant="secondary">NAICS {cover.naicsCode}</Badge>
            <Badge variant="secondary">Revision {revision}</Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {updated}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cover.badges.map((badge) => (
              <Badge key={badge} variant="outline" className="border-brand text-brand-700 bg-card">
                {badge}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDownload(markdown, filename)}
          >
            <Download className="size-3.5" />
            Download .md
          </Button>
          {status === 'DRAFT' ? (
            <BidDraftApproveButton
              draftId={draft.id}
              status={status}
              size="sm"
              onTransitioned={onTransitioned ? () => onTransitioned() : undefined}
            />
          ) : status === 'REVIEW' ? (
            <BidDraftSubmitButton
              draftId={draft.id}
              status={status}
              responseVersion={revision}
              source={source}
              size="sm"
              onTransitioned={onTransitioned ? () => onTransitioned() : undefined}
            />
          ) : (
            <Badge variant="outline" className="border-brand text-brand-700 bg-card font-semibold">
              Awaiting human submission
            </Badge>
          )}
          {status === 'SUBMITTED' ? (
            <Badge
              variant="default"
              className="bg-brand text-brand-foreground font-semibold tracking-wide"
            >
              Submitted
            </Badge>
          ) : null}
          <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground ml-auto">
            Status flag: {status} — human-confirmed submission.
          </p>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:hidden">
          <span className="text-eyebrow">Document Body</span>
          <CardTitle className="font-display text-xl mt-1">Printable Markdown</CardTitle>
        </CardHeader>
        <CardContent>
          <article
            data-testid="bid-draft-markdown"
            className="max-w-none rounded-lg border border-border bg-card p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words print:border-0 print:p-0"
          >
            {markdown}
          </article>
        </CardContent>
      </Card>

      <BidDraftAuditRow data={data} />
    </div>
  );
}
