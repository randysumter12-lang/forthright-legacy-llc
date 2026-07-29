// @polsia:user-owned — post-checkout cancel landing for the framework
// /api/stripe-billing/checkout funnel. Static Server Component with no data
// fetch and no client island — Stripe dropped the buyer here after they hit
// "cancel" on the hosted checkout page; we surface a calm recovery state and
// the links they need to retry or check an existing subscription.

import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Checkout cancelled',
  description: `Your ${siteName} checkout was cancelled — your card was not charged.`,
  robots: { index: false, follow: false },
};

export default function CheckoutCancelledPage() {
  return (
    <main className="flex flex-col">
      <section className="section">
        <div className="container-page max-w-2xl">
          <span className="text-eyebrow">Checkout</span>
          <h1 className="font-display text-h1 mt-2 font-bold tracking-tight">Checkout cancelled</h1>
          <p className="mt-3 text-body text-muted-foreground">
            No charge was made. You can pick a plan whenever you&rsquo;re ready — or pick up where
            you left off if you already have an active {siteName} subscription.
          </p>

          <Card className="mt-8 border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-5 p-7">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
                <p className="text-body text-muted-foreground">
                  Your card was <span className="font-medium text-foreground">not charged</span>.
                  The pending checkout session has been discarded.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/pricing">Retry plan selection</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/billing">View billing dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
