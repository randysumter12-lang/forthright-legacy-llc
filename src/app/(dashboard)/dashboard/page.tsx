// @polsia:user-owned — dashboard landing page (replaces the dashboard-shell
// module's seeded overview). Composes the subscription gate + tier-aware
// dashboard home island. Both islands live in src/components/custom/dashboard.

import type { Metadata } from 'next';
import { DashboardGate } from '@/components/custom/dashboard/dashboard-gate';
import { DashboardHome } from '@/components/custom/dashboard/dashboard-home';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: `Your ${siteName} workspace — current plan, opportunities, and tools.`,
  alternates: { canonical: '/dashboard' },
  robots: { index: false, follow: false },
};

export default function DashboardIndex() {
  return (
    <DashboardGate>
      <DashboardHome />
    </DashboardGate>
  );
}
