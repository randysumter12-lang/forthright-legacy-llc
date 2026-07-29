// @polsia:user-owned — billing page gate.
//
// /dashboard/billing requires a session AND at least one prior subscription
// (active OR canceled — a billing page for a never-paid visitor has nothing
// to show). Unauthenticated → /login. Authenticated but never subscribed →
// /pricing (the funnel entry).

'use client';

import type { ReactNode } from 'react';
import * as React from 'react';
import { useSession } from '@/lib/auth-client';
import { RedirectTo } from '@/lib/redirect-to';

type Phase = 'loading' | 'redirecting' | 'ready';

export interface BillingGateProps {
  children: ReactNode;
}

export function BillingGate({ children }: BillingGateProps) {
  const { data, isPending } = useSession();
  const [phase, setPhase] = React.useState<Phase>('loading');
  const [destination, setDestination] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isPending) return;
    if (!data?.user) {
      setDestination('/login');
      setPhase('redirecting');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/billing/subscription-history', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401) {
          setDestination('/login');
          setPhase('redirecting');
          return;
        }
        if (!res.ok) {
          setPhase('ready'); // show the page; downstream surfaces error
          return;
        }
        const body = (await res.json()) as { hasAny: boolean };
        if (!body.hasAny) {
          setDestination('/pricing');
          setPhase('redirecting');
          return;
        }
        setPhase('ready');
      } catch {
        if (cancelled) return;
        // Soft default — show page so the error is visible, not silent.
        setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.user, isPending]);

  if (phase === 'redirecting' && destination) {
    return <RedirectTo to={destination} />;
  }
  if (phase !== 'ready') {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-gutter py-section">
        <p className="text-small text-muted-foreground">Loading your billing…</p>
      </main>
    );
  }
  return <>{children}</>;
}
