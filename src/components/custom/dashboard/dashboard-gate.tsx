// @polsia:user-owned — dashboard gate.
//
// /dashboard requires (1) a session and (2) an active subscription at
// ANY tier (Starter/Professional/Elite). Unauth → /login. Auth but no
// subscription → /pricing. Auth + subscription → render the dashboard.

'use client';

import type { ReactNode } from 'react';
import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import { SubscriptionEnvelope } from '@/lib/contracts/subscription';
import { RedirectTo } from '@/lib/redirect-to';

type Phase = 'loading' | 'redirecting' | 'ready';

export interface DashboardGateProps {
  children: ReactNode;
}

export function DashboardGate({ children }: DashboardGateProps) {
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
        const env = await apiFetch('/api/billing/subscription', {
          schema: SubscriptionEnvelope,
        });
        if (cancelled) return;
        if (env.active) {
          setPhase('ready');
        } else {
          setDestination('/pricing');
          setPhase('redirecting');
        }
      } catch {
        // 401 means the session vanished between checks; re-redirect to login.
        if (cancelled) return;
        setDestination('/login');
        setPhase('redirecting');
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
        <p className="text-small text-muted-foreground">Loading dashboard…</p>
      </main>
    );
  }
  return <>{children}</>;
}
