// @polsia:shared — edit only through declared slots. Code installed by polsia/template-next@0.3.0.
//
// D18: Next.js 16 renamed `middleware.ts` → `proxy.ts`. Do NOT create a
// `middleware.ts`. The Polsia validator rejects the old name (it is not a
// local biome rule — `npm run lint` only scans src/tests).
//
// This file is the load-bearing wire-up for:
//   - CSP with per-request nonce
//   - frame-ancestors 'none'
//   - The `composed` middleware_chain slot
//
// Modules add middleware through the declared slot, NOT by editing this
// file directly. The CSP is built in `src/lib/csp.ts`: script-src stays
// strict (nonce + 'strict-dynamic', no 'unsafe-inline'/'unsafe-eval' in
// production) — that is a permanent block. style-src deliberately allows
// 'unsafe-inline' so headless UI primitives (Radix/shadcn) work in prod; the
// rationale lives in csp.ts and the posture is locked by tests/unit/csp.test.ts.

import { type NextRequest, NextResponse } from 'next/server';
import { buildCsp } from '@/lib/csp';
// Per-app extra CSP sources (frame/connect/media/font/img). User-owned, default empty.
import { cspExtraSources } from './next.user-config';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  // @polsia:slot middleware_chain start
  // Canonicalize host: legacy polsia stage aliases (.polsia.io / .polsia.io)
  // and www.rigelcontracts.co all 301 to apex — hosts that already match
  // pass through to CSP. Path + query are preserved verbatim. The algorithm
  // is duplicated in src/lib/host-redirect.ts and locked by
  // tests/unit/proxy/host-redirect.test.ts.
  const APEX_HOST = 'rigelcontracts.co';
  const LEGACY_HOSTS = new Set([
    'rigel-solutions.polsia.io',
    'www.rigel-solutions.polsia.io',
    'rigel-solutions.polsia.io',
    'www.rigel-solutions.polsia.io',
  ]);
  const incomingHost = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  ).toLowerCase();
  const incomingPath = request.nextUrl.pathname;
  const incomingSearch = request.nextUrl.search;
  const isSkippablePath =
    incomingPath === '/favicon.ico' ||
    incomingPath.startsWith('/api') ||
    incomingPath.startsWith('/_next/');
  if (
    incomingHost !== '' &&
    !isSkippablePath &&
    incomingHost !== APEX_HOST &&
    (incomingHost === `www.${APEX_HOST}` || LEGACY_HOSTS.has(incomingHost))
  ) {
    return NextResponse.redirect(
      new URL(incomingPath + incomingSearch, `https://${APEX_HOST}`).toString(),
      301,
    );
  }
  // Modules contribute middleware entries (e.g., rate-limit, webhook
  // signature pre-checks) here via their manifest `contributions` block.
  // The installer maintains ordering per the module's `ordering` field.
  // Do NOT hand-edit this slot — the install-hash check will reject it.
  // @polsia:slot middleware_chain end

  // CSP — script-src strict (nonce + 'strict-dynamic'); style-src relaxed for
  // headless UI. Built in src/lib/csp.ts (single source, unit-tested). The
  // per-request nonce is still exposed via x-nonce for script-src consumers.
  const csp = buildCsp(nonce, isDev, process.env.NEXT_PUBLIC_API_URL ?? '', cspExtraSources);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
