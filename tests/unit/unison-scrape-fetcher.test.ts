// @polsia:user-owned — Unison Global scraper pure-helper tests. The data
// plane (Prisma / runUnisonScrape upsert path) is exercised via the live
// smoke test; here we verify URL construction, OpenBeta payload parsing,
// set-aside normalization, and the lead-lag discrimination.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AWARD_CEILING,
  AWARD_FLOOR,
  buildBuyUrl,
  fetchUnisonBuys,
  parseBuy,
  UNISON_PUBLIC_BASE,
} from '../../src/lib/business/unison-scrape-fetcher';
import fixture1 from '../fixtures/unison/one.json';
import fixture3 from '../fixtures/unison/three.json';
import fixture2 from '../fixtures/unison/two.json';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T13:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildBuyUrl', () => {
  it('targets UNISON_PUBLIC_BASE with encoded NAICS list', () => {
    const { url } = buildBuyUrl({
      naicsList: ['541512', '541511', '541519', '541690', '541618', '541330'],
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
    });
    expect(url.startsWith(UNISON_PUBLIC_BASE)).toBe(true);
    expect(decodeURIComponent(url)).toContain('541512');
    expect(decodeURIComponent(url)).toContain('541690');
  });

  it('honors postedFrom/postedTo window for date scoping', () => {
    const { url } = buildBuyUrl({
      naicsList: ['541512'],
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
      limit: 25,
    });
    expect(url).toContain('postedFrom=07%2F19%2F2026');
    expect(url).toContain('postedTo=07%2F20%2F2026');
    expect(url).toContain('limit=25');
  });
});

describe('parseBuy (OpenBeta payload shape)', () => {
  it('parses one.json — SDVOSB IT services with active target', () => {
    const parsed = parseBuy({ ...fixture1 });
    expect(parsed).not.toBeNull();
    expect(parsed?.source).toBe('UNISON');
    expect(parsed?.unisonBuyId).toBe('UB-001');
    expect(parsed?.unisonRevision).toBe(1);
    expect(parsed?.buyerType).toBe('Federal');
    expect(parsed?.leadLagState).toBe('LEAD');
    expect(parsed?.activeTargetPrice).toBe(8400);
    expect(parsed?.bidDecrement).toBe(50);
    expect(parsed?.category).toBe('IT_SERVICES');
    expect(parsed?.setAside).toBe('SDVOSBC');
    expect(parsed?.isSetAside).toBe(true);
    expect(AWARD_FLOOR).toBe(3500);
    expect(AWARD_CEILING).toBe(10000);
  });

  it('parses two.json — unrestricted consulting opportunity with no null setAside', () => {
    const parsed = parseBuy({ ...fixture2 });
    expect(parsed).not.toBeNull();
    expect(parsed?.category).toBe('CONSULTING');
    expect(parsed?.setAside).toBeNull();
    expect(parsed?.isSetAside).toBe(false);
    expect(parsed?.leadLagState).toBe('LAG');
    expect(parsed?.unisonRevision).toBe(3);
  });

  it('parses three.json — cross-source dedupe key persisted on solicitationNumber', () => {
    const parsed = parseBuy({ ...fixture3 });
    expect(parsed).not.toBeNull();
    expect(parsed?.solicitationNumber).toBe('36C10X-24-Q-0047');
    expect(parsed?.unisonBuyId).toBe('UB-003');
  });

  it('returns null when required fields are missing', () => {
    expect(parseBuy({ noticeId: 'X' })).toBeNull();
    expect(parseBuy({ title: 'no id', agency: 'whoever', naicsCode: '541512' })).toBeNull();
    expect(parseBuy({ title: 'incomplete', agency: 'A', naicsCode: '541512' })).toBeNull();
    // Single required-pair missing — agency absent
    expect(parseBuy({ title: 't', noticeId: 'X', naicsCode: '541512' })).toBeNull();
  });
});

describe('fetchUnisonBuys', () => {
  it('handles a 429 as RATE_LIMITED without parsing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('rate limited', { status: 429 }));
    const result = await fetchUnisonBuys({
      postedFromDays: 1,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(result.status).toBe('RATE_LIMITED');
    expect(result.records).toEqual([]);
  });

  it('parses a buys[] envelope into normalized records', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          buys: [
            {
              noticeId: 'U-1',
              title: 'Trade study',
              agency: 'Navy',
              naicsCode: '541690',
              activeTargetPrice: 6500,
              buyId: 'UB-1',
              revision: 1,
              buyerType: 'Federal',
              leadLagState: 'LEAD',
              lineItems: [{ clins: '0001', quantity: 1 }],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await fetchUnisonBuys({
      postedFromDays: 1,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(result.status).toBe('OK');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.source).toBe('UNISON');
    expect(result.records[0]?.activeTargetPrice).toBe(6500);
  });

  it('reports ERROR when the response is non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
    const result = await fetchUnisonBuys({
      postedFromDays: 1,
      fetchImpl: globalThis.fetch,
    });
    expect(result.status).toBe('ERROR');
    expect(result.errorMessage).toContain('500');
  });
});
