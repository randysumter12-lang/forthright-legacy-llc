// @polsia:user-owned — detail-view island for /sam/<id>. Loads the parent
// SAM.gov / Unison Global opportunity through /api/sam-opportunities/<id>,
// renders the static metadata + capability / human-approval affordances.
// All data fetches go through apiFetch — the page.tsx server component has
// no DB access. The Deadline line above the metadata row is the urgency
// lead-in to the Bid Response Pipeline CTA (rendered in page.tsx).
'use client';

import { AlertCircle, ArrowUpRight, Calendar, CheckCircle2, MapPin, Tag } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BidDraftApproveButton } from '@/components/custom/bid-draft-approve-button';
import { BidDraftSubmitButton } from '@/components/custom/bid-draft-submit-button';
import { BidOutcomeButtons } from '@/components/custom/bid-outcome-buttons';
import { OutcomeChip } from '@/components/custom/bid-outcome-chip';
import { CapabilityStatementButton } from '@/components/custom/capability-statement-button';
import { DeadlineUrgencyBadge } from '@/components/custom/deadline-urgency-badge';
import { SourceBadge } from '@/components/custom/source-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { deadlineUrgencyDetail } from '@/lib/business/sam-deadline';
import { SamOpportunityDetail } from '@/lib/contracts/sam-opportunity';

const CATEGORY_LABEL: Record<string, string> = {
  IT_SERVICES: 'IT Services',
  CMMC: 'CMMC Pre-Review',
  CONSULTING: 'Consulting',
  OTHER: 'Other',
};

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return currencyFmt.format(value);
}

interface Props {
  samOpportunityId: string;
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready';
      data: SamOpportunityDetail;
    }
  | { status: 'error'; message: string };

export function SamDetail({ samOpportunityId }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // mount guard — flips to false on unmount so in-flight requests don't call
  // setState after the component unmounts.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const data = await apiFetch(
          `/api/sam-opportunities/${encodeURIComponent(samOpportunityId)}`,
          { schema: SamOpportunityDetail },
        );
        if (!mountedRef.current) return;
        setState({ status: 'ready', data });
      } catch (err) {
        if (!mountedRef.current) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [samOpportunityId]);

  // Forced re-read after the submit button transitions a draft → SUBMITTED,
  // so the badge flips from REVIEW to SUBMITTED without a full nav. The
  // <BidOutcomeButtons> island reuses the same callback — once an outcome
  // is stamped on the row, the GET returns the populated envelope, the
  // chip renders, and the buttons island self-hides.
  const handleTransitioned = useCallback(() => {
    (async () => {
      try {
        const data = await apiFetch(
          `/api/sam-opportunities/${encodeURIComponent(samOpportunityId)}`,
          { schema: SamOpportunityDetail },
        );
        if (!mountedRef.current) return;
        setState({ status: 'ready', data });
      } catch (err) {
        if (!mountedRef.current) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    })().catch(() => undefined);
  }, [samOpportunityId]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4 mt-2" />
          </CardContent>
        </Card>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col items-start gap-3 pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <h2 className="font-semibold">Could not load this opportunity</h2>
          </div>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </CardContent>
      </Card>
    );
  }

  const item = state.data.item;
  const deadlineDetail = deadlineUrgencyDetail(item.dueDate);
  const hasDeadline = Boolean(item.dueDate);

  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={item.source ?? 'SAM'} />
            {/* Outcome chip — appears next to the source badge on SUBMITTED
                rows that already carry a stamped terminal state. Color-coded:
                green = Won, red = Lost, amber = No response. */}
            <OutcomeChip outcome={state.data.outcome} />
            <Badge variant="secondary">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
            {item.isSetAside && item.setAside ? (
              <Badge variant="outline" className="border-brand text-brand-700 bg-brand-50">
                {item.setAside}
              </Badge>
            ) : null}
            {state.data.hasCapabilityStatement ? (
              <Badge variant="outline" className="border-border text-muted-foreground">
                Capability Statement Generated
              </Badge>
            ) : null}
            {state.data.draftStatus === 'DRAFT' ? (
              <Badge
                variant="outline"
                className="border-amber-400 bg-amber-100/40 text-amber-900 font-semibold"
              >
                Bid draft awaiting review
              </Badge>
            ) : state.data.draftStatus === 'REVIEW' ? (
              <Badge variant="outline" className="border-brand text-brand-700 bg-brand-50">
                Bid draft in review
              </Badge>
            ) : state.data.draftStatus === 'SUBMITTED' ? (
              <Badge variant="default" className="bg-brand text-brand-foreground">
                Bid draft submitted
              </Badge>
            ) : null}
          </div>
          <CardTitle className="font-display text-2xl xl:text-3xl font-bold leading-tight mt-2 text-balance">
            {item.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <Calendar className="size-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-eyebrow text-muted-foreground">Deadline</span>
              <p className="font-display text-base xl:text-lg font-semibold leading-snug">
                {hasDeadline ? (
                  <>
                    {formatDate(item.dueDate)}{' '}
                    <span className="font-normal text-muted-foreground">
                      ({deadlineDetail.label})
                    </span>
                  </>
                ) : (
                  <span className="font-normal text-muted-foreground">No deadline posted</span>
                )}
              </p>
            </div>
            <DeadlineUrgencyBadge dueDate={item.dueDate} className="ml-auto" />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" />
              {item.agency}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="size-3.5" />
              NAICS {item.naicsCode}
            </span>
            <span className="font-semibold text-primary">{formatCurrency(item.awardValue)}</span>
            <span className="font-mono text-caption text-muted-foreground">{item.noticeId}</span>
          </div>
          {item.description ? (
            <p className="text-body leading-relaxed text-muted-foreground">{item.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {item.uiLink ? (
              <a
                href={item.uiLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
              >
                View on SAM.gov
                <ArrowUpRight className="size-3.5" />
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {state.data.qualifications && state.data.qualifications.length > 0 ? (
        <section
          aria-label="Set-aside qualification chips"
          className="rounded-lg border border-border bg-card/60 px-4 py-4 shadow-sm"
        >
          <p className="text-eyebrow text-muted-foreground">Qualifies for</p>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            {state.data.qualifications.map((qualification) => (
              <div
                key={qualification.bucket}
                className="flex flex-col gap-1"
                title={qualification.reasoning}
              >
                <Badge variant="outline" className="border-brand bg-brand-50 text-brand-700">
                  {qualification.bucket}
                </Badge>
                <p className="max-w-64 text-caption text-muted-foreground leading-snug">
                  {qualification.reasoning}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {state.data.draftStatus === 'DRAFT' && state.data.bidDraftId ? (
        <section
          aria-label="Approvals pending"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/40 px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-2 text-amber-900">
            <CheckCircle2 className="size-4" />
            <p className="font-semibold">A draft bid package has been auto-generated.</p>
          </div>
          <BidDraftApproveButton
            draftId={state.data.bidDraftId}
            status={state.data.draftStatus}
            size="sm"
          />
        </section>
      ) : null}

      {state.data.draftStatus === 'REVIEW' ? (
        <section
          aria-label="In review"
          className="rounded-lg border border-brand bg-brand-50/40 px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-eyebrow text-brand-700">In review</p>
              <p className="text-body mt-1">
                Bid draft is staged for human submission. Review the printable Markdown and press{' '}
                <span className="font-semibold text-foreground">Mark as submitted</span> to record
                the submission audit row.
              </p>
            </div>
            {state.data.bidDraftId && state.data.bidDraftRevision != null ? (
              <BidDraftSubmitButton
                draftId={state.data.bidDraftId}
                status="REVIEW"
                responseVersion={state.data.bidDraftRevision}
                source={item.source ?? 'SAM'}
                size="sm"
                onTransitioned={handleTransitioned}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {state.data.draftStatus === 'SUBMITTED' && state.data.bidDraftSubmittedAt ? (
        <section
          aria-label="Submitted audit summary"
          className="flex flex-col gap-4 rounded-lg border border-brand bg-brand-50/40 px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow text-brand-700">Submitted</p>
              <p className="text-body">
                Bid draft marked submitted at{' '}
                <span className="font-mono text-foreground">{state.data.bidDraftSubmittedAt}</span>.
                The audit row is persisted on the bid draft row — open the draft page to view the
                full log.
              </p>
            </div>
          </div>
          {/* Outcome affordance — only when the bidDraftId is known. The
              island self-hides the moment state.data.outcome is populated
              (so the header chip becomes the single source of truth). */}
          {state.data.bidDraftId ? (
            <BidOutcomeButtons
              draftId={state.data.bidDraftId}
              outcome={state.data.outcome}
              onTransitioned={handleTransitioned}
            />
          ) : null}
        </section>
      ) : null}

      <CapabilityStatementButton samOpportunityId={item.id} title={item.title} />
    </div>
  );
}
