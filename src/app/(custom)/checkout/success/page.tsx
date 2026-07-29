// @polsia:user-owned — post-checkout success landing for the framework
// /api/stripe-billing/checkout funnel. Stripe redirects the browser here with
// ?session_id={CHECKOUT_SESSION_ID}; we immediately bounce the visitor into
// /dashboard/billing where the BillingManagement island reads the verified
// subscription. No DB work, no client island, no server-only import leaked
// into a page — redirect() is the only server-side action.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Checkout complete',
  description: `Your ${siteName} checkout finished successfully — finalizing your subscription.`,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ session_id?: string | string[] }>;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session_id } = await searchParams;
  const raw = Array.isArray(session_id) ? session_id[0] : session_id;

  if (raw && raw.length > 0) {
    const next = `/dashboard/billing?status=success&session_id=${encodeURIComponent(raw)}`;
    redirect(next);
  }

  return (
    <main className="flex flex-col">
      <section className="section">
        <div className="container-page max-w-2xl">
          <span className="text-eyebrow">Checkout</span>
          <h1 className="font-display text-h1 mt-2 font-bold tracking-tight">
            Finalizing your subscription…
          </h1>
          <p className="mt-3 text-body text-muted-foreground">
            Your payment succeeded. We&rsquo;re confirming the session with Stripe — you can review
            your plan and renewal date from the billing dashboard.
          </p>

          <Card className="mt-8 border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-7">
              <p className="text-body text-muted-foreground">
                If this page didn&rsquo;t redirect automatically, open the billing dashboard to
                continue.
              </p>
              <div>
                <Button asChild>
                  <Link href="/dashboard/billing">Open billing dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
