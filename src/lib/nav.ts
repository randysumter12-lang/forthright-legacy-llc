// @polsia:user-owned — app navigation rendered by SiteNav/SiteFooter and read by
// the sitemap. Edit it as pages are added or removed.
// This list is a convenience, not module registration.

export type NavGroup = 'primary' | 'secondary' | 'footer';

export interface NavItem {
  /** Visible link text. */
  label: string;
  /** App route, e.g. '/' or '/dashboard'. */
  href: string;
  /** Where it renders: top-nav 'primary'/'secondary', or 'footer'. */
  group: NavGroup;
  /** Group `primary` items into a dropdown: items sharing a `menu` value collapse
   *  into one "<menu> ⌄" top-bar slot (e.g. `menu: 'Resources'` on Blog/Docs/
   *  Changelog). Keeps the bar short. Ignored for 'secondary'/'footer'. */
  menu?: string;
  /** When true, render only if a session exists (see site-nav.tsx). */
  requiresAuth?: boolean;
  /** Sort key within a group (ascending); unordered items fall to the end. */
  order?: number;
}

// Keep the bar short: ~3-5 primary slots, group the tail with `menu`, push the
// rest to 'footer' (SiteNav overflows extras into a "More" dropdown). Example:
//   { label: 'Pricing', href: '/pricing', group: 'primary' },
//   { label: 'Blog',    href: '/blog',    group: 'primary', menu: 'Resources' },
//   { label: 'Docs',    href: '/docs',    group: 'primary', menu: 'Resources' },
//   { label: 'Sign in', href: '/login',   group: 'secondary' },
export const navItems: NavItem[] = [
  { label: 'Opportunities', href: '/sam', group: 'primary', order: 0 },
  { label: 'Pricing', href: '/#pricing', group: 'primary', order: 1 },
  { label: 'How It Works', href: '/#how-it-works', group: 'primary', order: 2 },
  { label: 'FAQ', href: '/#faq', group: 'primary', order: 3 },
  // Sign-in is reachable when logged out; Dashboard only when logged in.
  // better-auth's AuthNav sits in the dashboard; this secondary slot is
  // purely a route entry on the public surface.
  { label: 'Sign in', href: '/login', group: 'secondary', order: 0 },
  { label: 'Dashboard', href: '/dashboard', group: 'secondary', requiresAuth: true, order: 1 },
  // The full plan / pricing page is reachable from "(plan detail)" inline link
  // in the in-page PricingBand; from the nav it's consolidated into the
  // /#pricing anchor above. The /pricing route still ships and is in the
  // sitemap, just not promoted to a top-bar slot.
  { label: 'Plan detail', href: '/pricing', group: 'footer', order: 1 },
  { label: 'Billing', href: '/dashboard/billing', group: 'footer', requiresAuth: true, order: 2 },
  {
    label: 'Submitted bids',
    href: '/submitted-bids',
    group: 'footer',
    requiresAuth: true,
    order: 3,
  },
];
