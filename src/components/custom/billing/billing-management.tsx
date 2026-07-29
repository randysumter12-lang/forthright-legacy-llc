// @polsia:user-owned — billing management island.
//
// Renders the caller's CURRENT active subscription: tier badge, period days
// remaining, "auto-renew" status, and a "Cancel at period end" button. On
// cancel, POSTs /api/billing/portal { action: 'cancel' } and surfaces the
// 200 response on the same card.

'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { PortalRequest, SubscriptionEnvelope, type Tier } from '@/lib/contracts/subscription';
import { cn } from '@/lib/utils';

const TIER_NAME: Record<Tier, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ELITE: 'Elite / Concierge',
};

const TIER_BLURB: Record<Tier, string> = {
  STARTER: 'Daily SAM.gov feed, capability statements, monthly bid drafting.',
  PROFESSIONAL: 'Unlimited automated bid drafts, autonomous refresh, set-aside positioning.',
  ELITE: 'Concierge delivery, hand-crafted capability statements, same-day turnaround.',
};

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type CancelStatus = 'idle' | 'loading' | 'done';

type Envelope = {
  active: boolean;
  subscription: {
    id: string;
    tier: Tier;
    status: 'active' | 'canceled' | 'expired';
    amountUsd: number;
    cancelAtPeriodEnd: boolean;
    periodStart: string;
    periodEnd: string;
    daysRemaining: number;
  } | null;
};

export function BillingManagement() {
  const [envelope, setEnvelope] = React.useState<
    { status: 'loading' } | { status: 'ready'; envelope: Envelope }
  >({ status: 'loading' });
  const [cancel, setCancel] = React.useState<CancelStatus>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const env = await apiFetch('/api/billing/subscription', {
        schema: SubscriptionEnvelope,
      });
      setEnvelope({ status: 'ready', envelope: env });
    } catch {
      // Should be guarded upstream; surface a soft error rather than crash.
      setError('We could not load your billing state.');
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCancel = React.useCallback(async () => {
    setCancel('loading');
    setError(null);
    try {
      const parsed = apiFetch('/api/billing/portal', {
        method: 'POST',
        body: JSON.stringify(PortalRequest.parse({ action: 'cancel' })),
      });
      await parsed;
      await refresh();
      setCancel('done');
    } catch {
      setCancel('idle');
      setError('Cancellation failed. Please try again.');
    }
  }, [refresh]);

  if (envelope.status === 'loading') {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex items-center gap-3 p-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-small text-muted-foreground">Loading your subscription…</p>
        </CardContent>
      </Card>
    );
  }

  const sub = envelope.envelope.subscription;
  if (!sub) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="font-display text-h4">No active subscription</p>
          <p className="text-small text-muted-foreground">
            Choose a plan to unlock Rigel Solutions&rsquo; autonomous contract identification +
            bidding features.
          </p>
          <div>
            <Button asChild>
              <a href="/pricing">View plans</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canceled = sub.cancelAtPeriodEnd;
  return (
    <div className="grid gap-6">
      <Card
        className={cn(
          'overflow-hidden border-border/70 shadow-brand',
          canceled ? 'border-amber-400/40' : '',
        )}
      >
        <CardContent className="flex flex-col gap-5 p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow">Current plan</p>
              <h2 className="font-display text-h2 text-foreground">{TIER_NAME[sub.tier]}</h2>
              <p className="mt-1 max-w-xl text-body text-muted-foreground">
                {TIER_BLURB[sub.tier]}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="font-display text-h3 text-foreground">${sub.amountUsd}</span>
              <span className="text-caption uppercase tracking-wide text-muted-foreground">
                / month
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 border-y border-border/60 py-4 sm:grid-cols-3">
            <div>
              <dt className="text-eyebrow">Period start</dt>
              <dd className="font-mono text-body text-foreground">
                {formatDate(new Date(sub.periodStart))}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow">Next renewal</dt>
              <dd className="font-mono text-body text-foreground">
                {formatDate(new Date(sub.periodEnd))}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow">Days remaining</dt>
              <dd className="font-mono text-body text-foreground">
                {sub.daysRemaining} {sub.daysRemaining === 1 ? 'day' : 'days'}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-muted-foreground">
              {canceled ? (
                <>
                  <span className="font-medium text-amber-300">Auto-renew is OFF.</span> Your access
                  remains active until{' '}
                  <span className="font-medium text-foreground">
                    {formatDate(new Date(sub.periodEnd))}
                  </span>
                  . Re-subscribe any time before then to keep continuous access.
                </>
              ) : (
                <>
                  Auto-renew is <span className="font-medium text-foreground">ON</span>. Cancel any
                  time to stop the next charge — you keep access until the period ends.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {!canceled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancel === 'loading'}
                  onClick={handleCancel}
                >
                  {cancel === 'loading' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Processing…
                    </>
                  ) : (
                    'Cancel at period end'
                  )}
                </Button>
              ) : (
                <Button asChild variant="default" size="sm">
                  <a href="/pricing">View upgrade plans</a>
                </Button>
              )}
            </div>
          </div>

          {cancel === 'done' && !canceled ? null : null}
          {error ? (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-7">
          <p className="text-eyebrow">What you get</p>
          <p className="text-body text-muted-foreground">
            {TIER_BLURB[sub.tier]} Access to all tier-appropriate tools — including the SAM.gov
            feed, bid drafts, and capability statements — is open for the duration of this period.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <a href="/sam">Browse opportunities</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard">Back to dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
