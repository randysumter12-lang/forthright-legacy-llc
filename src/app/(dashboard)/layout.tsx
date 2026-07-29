// @polsia:user-owned — auth-gated layout for everything under (dashboard).
// Redirects unauthenticated visitors to /login. Houses the top-bar + sidebar
// shell used by /dashboard, /dashboard/billing, /submitted-bids, and any
// future member-area routes (settings, admin, teams).

import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
