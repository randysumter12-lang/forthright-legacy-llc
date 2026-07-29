// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Rigel Solutions';
export const siteDescription =
  'AI-powered Federal Micro-Contract Capture Agency. Rigel Solutions autonomously identifies $3,500–$10,000 SAM.gov and Unison Global micro-purchases, drafts the bid, and positions your set-aside eligibility — three subscription tiers from Starter to Elite Concierge.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match the Midnight Navy + Brushed Silver brand seed:
//   --brand-h: 225, --brand-l: 0.42 → brand-700 ≈ #1a2b4a, --brand-900 ≈ #0b1d3a
//   --accent (Brushed Silver) ≈ oklch(0.78 0.02 230) → #c0c8d2
export const brandVisual = {
  /** PWA browser-UI / status-bar color. */
  themeColor: '#0b1d3a',
  /** PWA splash + install background. */
  backgroundColor: '#050d20',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#050d20',
    foreground: '#c0c8d2',
    /** Second line under the site name; '' hides it. */
    tagline: 'Midnight Navy · Brushed Silver',
  },
  /** Brushed Silver accent — used in OG/manifest renders that read a literal hex. */
  accent: '#c0c8d2',
} as const;
