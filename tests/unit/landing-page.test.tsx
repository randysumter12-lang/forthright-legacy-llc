// @polsia:user-owned — landing-page smoke tests.
//
// The home lives at src/app/(setup)/page.tsx and ships the brief-locked
// content end-to-end. The plan (§2.4) calls for three checks:
//
//   1. metadata is wired (title/description/exports per page).
//   2. the three tier labels and prices ship on the SSR'd home.
//   3. the hero H1 reads the brief-locked micro-contract pitch.
//
// All three checks render against the real page component — no module
// stubs other than `next/link` (the v16 server renderer in jsdom needs an
// <a> shim) and `next/navigation` (usePathname/useRouter are inert in
// a static render; replacing them avoids any DOM-plugin lookup during
// the initial pass).

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    createElement('a', { href }, children),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}));

describe('landing page exports', () => {
  it('module exports per-page metadata tied to the brand', async () => {
    const mod = await import('@/app/(setup)/page');
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.title?.absolute).toContain('Rigel');
    // Brief description thread: "AI" + "Federal Micro-Contract Capture Agency"
    expect(mod.metadata.description).toMatch(/AI/);
    expect(mod.metadata.description).toMatch(/Federal Micro-Contract Capture Agency/i);
    expect(mod.metadata.alternates?.canonical).toBe('/');
  });

  it('page is exported as a default render function (HomePage)', async () => {
    const mod = await import('@/app/(setup)/page');
    expect(typeof mod.default).toBe('function');
  });
});

describe('landing page SSR markup', () => {
  it('renders the hero H1 with the brief-locked micro-contract anchor', async () => {
    const { default: HomePage } = await import('@/app/(setup)/page');
    const html = renderToStaticMarkup(createElement(HomePage));
    // The H1 wraps the trailing "automatically." in a <span> for the brand color,
    // so the literal contiguous copy is broken into two text nodes. Assert the
    // two pieces rather than the full sentence.
    expect(html).toContain('We find and draft your next federal micro-contract');
    expect(html).toMatch(/<span[^>]*text-primary[^>]*>\s*automatically\.\s*<\/span>/);
  });

  it('renders the three pricing-band tier names and prices (Starter $95, Professional $495, Elite $1,500)', async () => {
    const { default: HomePage } = await import('@/app/(setup)/page');
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('Starter');
    expect(html).toContain('Professional');
    expect(html).toContain('Elite');
    expect(html).toContain('$95');
    expect(html).toContain('$495');
    expect(html).toContain('$1,500');
  });

  it('renders the final CTA with the Elite tier as the copy anchor', async () => {
    const { default: HomePage } = await import('@/app/(setup)/page');
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('Rigel · Elite · Concierge');
    expect(html).toContain('Go Elite on every bid window.');
    // Elite price label is text on the button (flagged as bundle label-text).
    expect(html).toContain('Go Elite — $1,500/mo');
  });
});

describe('TIER_CATALOG — brief-locked tier shape', () => {
  it('exposes STARTER, PROFESSIONAL, ELITE in order', async () => {
    const { TIER_CATALOG } = await import('@/lib/contracts/subscription');
    expect(TIER_CATALOG.map((t) => t.tier)).toEqual(['STARTER', 'PROFESSIONAL', 'ELITE']);
  });

  it('matches the brief-locked price + name + badge triplets', async () => {
    const { TIER_CATALOG } = await import('@/lib/contracts/subscription');
    const byTier = Object.fromEntries(TIER_CATALOG.map((t) => [t.tier, t]));
    expect(byTier.STARTER.amountUsd).toBe(95);
    expect(byTier.STARTER.name).toBe('Starter');
    expect(byTier.STARTER.interval).toBe('per month');

    expect(byTier.PROFESSIONAL.amountUsd).toBe(495);
    expect(byTier.PROFESSIONAL.name).toBe('Professional');
    expect(byTier.PROFESSIONAL.badge).toBe('Most selected');

    expect(byTier.ELITE.amountUsd).toBe(1500);
    expect(byTier.ELITE.name).toBe('Elite / Concierge');
    expect(byTier.ELITE.badge).toBe('Concierge');
  });
});
