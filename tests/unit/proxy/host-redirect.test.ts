import { describe, expect, it } from 'vitest';
import { resolveHostRedirect } from '@/lib/host-redirect';

// Locks host canonicalization for the rigelcontracts.co cutover: legacy
// polsia stage aliases and www.rigelcontracts.co must 301 to the apex, with
// path + query preserved verbatim. The proxy matcher excludes /api, /_next/,
// and /favicon.ico, but resolveHostRedirect short-circuits those paths
// anyway so future matcher loosening can't accidentally redirect them.
describe('resolveHostRedirect', () => {
  it('redirects rigel-solutions.polsia.io to apex, preserving path + query', () => {
    expect(resolveHostRedirect('rigel-solutions.polsia.io', null, '/orig/path', '?qs=1')).toBe(
      'https://rigelcontracts.co/orig/path?qs=1',
    );
  });

  it('redirects www.rigel-solutions.polsia.io to apex, preserving path + query', () => {
    expect(resolveHostRedirect('www.rigel-solutions.polsia.io', null, '/orig/path', '?qs=1')).toBe(
      'https://rigelcontracts.co/orig/path?qs=1',
    );
  });

  it('redirects www.rigelcontracts.co to apex, preserving path + query', () => {
    expect(resolveHostRedirect('www.rigelcontracts.co', null, '/orig/path', '?qs=1')).toBe(
      'https://rigelcontracts.co/orig/path?qs=1',
    );
  });

  it('does not redirect when host is already the apex', () => {
    expect(resolveHostRedirect('rigelcontracts.co', null, '/orig/path', '?qs=1')).toBeNull();
  });

  it('does not redirect /api paths even when host would otherwise match', () => {
    expect(
      resolveHostRedirect('rigel-solutions.polsia.io', null, '/api/anything', '?qs=1'),
    ).toBeNull();
  });

  it('resolves host from x-forwarded-host when present (not the bare host)', () => {
    expect(
      resolveHostRedirect('www.rigelcontracts.co', 'rigel-solutions.polsia.io', '/foo', ''),
    ).toBe('https://rigelcontracts.co/foo');
  });

  it('always emits https: scheme (never http:)', () => {
    expect(resolveHostRedirect('rigel-solutions.polsia.io', null, '/', '')).toMatch(
      /^https:\/\/rigelcontracts\.co\//,
    );
    expect(resolveHostRedirect('rigel-solutions.polsia.io', null, '/', '')).not.toMatch(
      /^http:\/\//,
    );
  });
});
