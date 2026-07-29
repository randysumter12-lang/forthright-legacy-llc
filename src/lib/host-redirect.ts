// @polsia:user-owned — pure host-redirect helper used by proxy.ts.
// Returns the redirect target URL when an incoming request hits a host we
// canonicalize to the production apex, else null. Edge-pure: no I/O, no
// NextRequest/NextResponse coupling, so it's directly unit-testable.

const APEX = 'rigelcontracts.co';
const WWW_APEX = `www.${APEX}`;

// Legacy Polsia stage aliases (this app only). Both .polsia.io and .polsia.io
// variants are matched because we don't know which one the operator left live.
const LEGACY_HOSTS = new Set([
  'rigel-solutions.polsia.io',
  'www.rigel-solutions.polsia.io',
  'rigel-solutions.polsia.io',
  'www.rigel-solutions.polsia.io',
]);

function isSkippablePath(pathname: string): boolean {
  return (
    pathname === '/favicon.ico' || pathname.startsWith('/api') || pathname.startsWith('/_next/')
  );
}

/**
 * Resolve the host to redirect from (preferring the forwarded host so we honor
 * whatever the platform's edge populated), then return the canonical URL to
 * redirect to — or null if no redirect applies.
 */
export function resolveHostRedirect(
  forwardedHost: string | null,
  bareHost: string | null,
  pathname: string,
  search: string,
): string | null {
  const host = (forwardedHost ?? bareHost ?? '').toLowerCase();
  if (!host) return null;
  if (isSkippablePath(pathname)) return null;
  if (host === APEX) return null;
  if (host === WWW_APEX || LEGACY_HOSTS.has(host)) {
    return new URL(pathname + search, `https://${APEX}`).toString();
  }
  return null;
}
