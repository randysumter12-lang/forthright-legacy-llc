// @polsia:user-owned — tiny shared client-side redirect island.
//
// Fires `router.replace(to)` once on mount (and again if `to` changes) and
// renders a brief "Redirecting…" placeholder while the route navigates.
// Used by every gate component to redirect anonymous or unsubscribed users
// without flashing protected content.
//
// Server components should NEVER import this file — guards run client-side.

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export interface RedirectToProps {
  to: string;
  message?: string;
}

export function RedirectTo({ to, message = 'Redirecting…' }: RedirectToProps) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [to, router]);
  return (
    <main className="flex min-h-[40vh] items-center justify-center px-gutter py-section">
      <p className="text-small text-muted-foreground">{message}</p>
    </main>
  );
}
