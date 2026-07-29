// @polsia:user-owned — pricing page gate.
//
// Polls /api/billing/subscription. Existing Professional/Elite subscribers
// are sent straight to /dashboard — no need to re-shop. Starter subscribers
// see the table so they can upgrade; unauthenticated visitors see the table
// (the funnel entry).
//
// Subscription is OPTIONAL here — pricing is also the funnel entry.

'use client';

import type { ReactNode } from 'react';
import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { SubscriptionEnvelope, type Tier } from '@/lib/contracts/subscription';
import { RedirectTo } from '@/lib/redirect-to';

type Phase = 'loading' | 'redirecting' | 'ready';

export interface PricingGateProps {
  children: ReactNode;
}

export function PricingGate({ children }: PricingGateProps) {
  const [phase, setPhase] = React.useState<Phase>('loading');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const envelope = await apiFetch('/api/billing/subscription', {
          schema: SubscriptionEnvelope,
        });
        if (cancelled) return;
        const tier: Tier | null =
          envelope.active && envelope.subscription ? envelope.subscription.tier : null;
        if (tier === 'PROFESSIONAL' || tier === 'ELITE') {
          setPhase('redirecting');
        } else {
          setPhase('ready');
        }
      } catch {
        // 401 (no session) → anonymous visitor, render the table.
        if (cancelled) return;
        setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'redirecting') {
    return <RedirectTo to="/dashboard" message="Loading your dashboard…" />;
  }
  if (phase !== 'ready') {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-gutter py-section">
        <p className="text-small text-muted-foreground">Loading pricing…</p>
      </main>
    );
  }
  return <>{children}</>;
}
