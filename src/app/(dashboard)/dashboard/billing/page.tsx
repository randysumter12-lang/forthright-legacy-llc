// @polsia:user-owned — in-app billing management page.
//
// Lives inside the (dashboard) route group so it inherits the dashboard-shell
// sidebar/topbar, then wraps the BillingGate (auth + has-ever-subscribed)
// + BillingManagement island (current period + cancel controls).

import type { Metadata } from 'next';
import { BillingGate } from '@/components/custom/billing/billing-gate';
import { BillingManagement } from '@/components/custom/billing/billing-management';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Billing',
  description: `Manage your ${siteName} subscription — view your current plan, cancel at period end, and review renewals.`,
  alternates: { canonical: '/dashboard/billing' },
  robots: { index: false, follow: false },
};

export default function DashboardBillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-eyebrow">Subscription</p>
        <h1 className="font-display text-h1 font-bold tracking-tight">Billing &amp; plan</h1>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">
          View your current period, days remaining, and renew / cancel controls for your {siteName}{' '}
          subscription.
        </p>
      </header>
      <BillingGate>
        <BillingManagement />
      </BillingGate>
    </div>
  );
}
