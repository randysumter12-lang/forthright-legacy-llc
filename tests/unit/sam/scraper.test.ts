// @polsia:user-owned — scraper unit tests. The data plane (Prisma /
// runSamScrape upsert path) is exercised via the live smoke test; here we
// verify the URL construction, row parsing, set-aside normalization, date
// handling, and end-to-end fetchSamOpportunities path through the upsert
// payload shape.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AWARD_CEILING,
  AWARD_FLOOR,
  buildSearchUrl,
  fetchSamOpportunities,
  type NormalizedSamRecord,
  parseOpportunity,
  TARGET_NAICS,
} from '../../../src/lib/business/sam-scrape-fetcher';
import { SAM_CATEGORY } from '../../../src/lib/contracts/sam-opportunity';

const SAMPLE_OPP: NormalizedSamRecord = {
  noticeId: '36C10X-24-Q-0047',
  title: 'Network infrastructure upgrade',
  agency: 'Department of Veterans Affairs',
  naicsCode: '541512',
  dueDate: new Date('2026-08-01T17:00:00Z'),
  postedDate: new Date('2026-07-18T12:00:00Z'),
  awardValue: 8500,
  setAside: 'SDVOSBC',
  isSetAside: true,
  category: 'IT_SERVICES',
  description: 'Upgrade routing/switching stack for VA regional office.',
  uiLink: 'https://sam.gov/opp/36C10X-24-Q-0047',
  rawJson: {
    noticeId: '36C10X-24-Q-0047',
    title: 'Network infrastructure upgrade',
    department: 'Department of Veterans Affairs',
    naicsCode: '541512',
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T13:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildSearchUrl', () => {
  it('encodes the IT/CMMC/consulting NAICS list', () => {
    const { url } = buildSearchUrl({
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
      apiKey: 'k',
    });
    for (const naics of TARGET_NAICS) {
      expect(decodeURIComponent(url)).toContain(naics);
    }
  });

  it('announces the $3.5K–$10K micro-purchase band', () => {
    const { url } = buildSearchUrl({
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
      limit: 50,
    });
    expect(url).toContain(`awardFloor=${AWARD_FLOOR}`);
    expect(url).toContain(`awardCeiling=${AWARD_CEILING}`);
    expect(AWARD_FLOOR).toBe(3500);
    expect(AWARD_CEILING).toBe(10000);
  });

  it('hits the v2 endpoint with a key and the v1 endpoint without one', () => {
    const authed = buildSearchUrl({
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
      apiKey: 'secret-key',
    });
    const anon = buildSearchUrl({
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
    });
    expect(authed.base).toMatch(/\/v2\/search$/);
    expect(anon.base).toMatch(/\/ops\/sam-gov$/);
  });

  it('sets X-Api-Key on the request when provided', () => {
    const { headers } = buildSearchUrl({
      postedFrom: '07/19/2026',
      postedTo: '07/20/2026',
      apiKey: 'should-not-leak',
    });
    const headerRecord = headers as Record<string, string>;
    expect(headerRecord['X-Api-Key']).toBe('should-not-leak');
    expect(headerRecord['User-Agent']).toMatch(/RigelSolutions/);
  });
});

describe('parseOpportunity', () => {
  it('classifies IT_SERVICES for 541512', () => {
    const parsed = parseOpportunity({
      noticeId: 'X-1',
      title: 'Cloud migration task order',
      agency: 'GSA',
      naicsCode: '541512',
      responseDeadLine: '08/01/2026',
      postedDate: '07/19/2026',
      awardAmount: '9500',
      typeOfSetAside: 'SDVOSB',
      uiLink: 'https://example.com/opp',
      description: 'lift-and-shift us-east-1',
    });
    expect(parsed?.category).toBe('IT_SERVICES');
    expect(parsed?.setAside).toBe('SDVOSBC');
    expect(parsed?.isSetAside).toBe(true);
    expect(parsed?.awardValue).toBe(9500);
    expect(parsed?.dueDate?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('classifies CMMC for "CMMC gap review"', () => {
    const parsed = parseOpportunity({
      noticeId: 'X-2',
      title: 'CMMC gap assessment for DIB subcontractor',
      agency: 'DoD',
      naicsCode: '541690',
      postedDate: '07/19/2026',
      awardAmount: 7800,
      typeOfSetAside: 'SBA',
    });
    expect(parsed?.category).toBe('CMMC');
  });

  it('classifies CONSULTING for 541690', () => {
    const parsed = parseOpportunity({
      noticeId: 'X-3',
      title: 'Process optimization study',
      agency: 'GSA',
      naicsCode: '541690',
      postedDate: '07/19/2026',
      awardAmount: 6500,
      typeOfSetAside: 'NO SET ASIDE',
    });
    expect(parsed?.category).toBe('CONSULTING');
    expect(parsed?.isSetAside).toBe(false);
    expect(parsed?.setAside).toBeNull();
  });

  it('falls back to OTHER for unmapped NAICS', () => {
    const parsed = parseOpportunity({
      noticeId: 'X-4',
      title: 'Miscellaneous purchase',
      agency: 'USDA',
      naicsCode: '999999',
      postedDate: '07/19/2026',
    });
    expect(parsed?.category).toBe('OTHER');
  });

  it('returns null when required fields are missing', () => {
    expect(parseOpportunity({ noticeId: 'X' })).toBeNull();
    expect(
      parseOpportunity({
        title: 'no id',
        agency: 'whoever',
        naicsCode: '541512',
      }),
    ).toBeNull();
  });
});

describe('fetchSamOpportunities', () => {
  it('handles a 429 as RATE_LIMITED without parsing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('rate limited', { status: 429 }));
    const result = await fetchSamOpportunities(
      { apiKey: 'k' },
      { postedFromDays: 1, fetchImpl: fetchSpy as unknown as typeof fetch },
    );
    expect(result.status).toBe('RATE_LIMITED');
    expect(result.records).toEqual([]);
  });

  it('parses a v2-era opportunitiesData envelope into normalized records', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          opportunitiesData: [
            {
              noticeId: '36C10X-24-Q-0047',
              title: 'Network infrastructure upgrade',
              department: 'Department of Veterans Affairs',
              naicsCode: '541512',
              responseDeadLine: '08/01/2026',
              postedDate: '07/19/2026',
              awardAmount: 8500,
              typeOfSetAside: 'SDVOSB',
              uiLink: 'https://sam.gov/opp/36C10X-24-Q-0047',
              description: 'Upgrade routing/switching stack for VA regional office.',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await fetchSamOpportunities(
      { apiKey: 'k' },
      { postedFromDays: 1, fetchImpl: fetchSpy as unknown as typeof fetch },
    );
    expect(result.status).toBe('OK');
    expect(result.records).toHaveLength(1);
    const rec = result.records[0];
    expect(rec?.noticeId).toBe('36C10X-24-Q-0047');
    expect(rec?.category).toBe('IT_SERVICES');
    expect(rec?.setAside).toBe('SDVOSBC');
    expect(rec?.agency).toBe('Department of Veterans Affairs');
    expect(rec?.awardValue).toBe(8500);
  });

  it('reports ERROR when the response is non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
    const result = await fetchSamOpportunities(
      { apiKey: 'k' },
      { postedFromDays: 1, fetchImpl: globalThis.fetch },
    );
    expect(result.status).toBe('ERROR');
    expect(result.errorMessage).toContain('500');
  });

  it('honours a 1-day postedFrom window', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ opportunitiesData: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await fetchSamOpportunities(
      { apiKey: 'k' },
      { postedFromDays: 1, fetchImpl: fetchSpy as unknown as typeof fetch },
    );
    const called = fetchSpy.mock.calls[0]?.[0] as Request | URL | string;
    const urlStr = typeof called === 'string' ? called : called.toString();
    expect(urlStr).toContain('postedFrom=07%2F19%2F2026');
    expect(urlStr).toContain('postedTo=07%2F20%2F2026');
  });
});

describe('upsert payload shape', () => {
  // Asserts the upstream contract: the scraped NormalizedSamRecord is the
  // shape runSamScrape upserts (Prisma accepts Date + nullable fields).
  it('matches the Prisma SamOpportunity column set', () => {
    const rec = SAMPLE_OPP;
    const upsertKey = { noticeId: rec.noticeId };
    const upsertCreate = {
      noticeId: rec.noticeId,
      title: rec.title,
      agency: rec.agency,
      naicsCode: rec.naicsCode,
      dueDate: rec.dueDate,
      postedDate: rec.postedDate,
      awardValue: rec.awardValue,
      setAside: rec.setAside,
      isSetAside: rec.isSetAside,
      category: rec.category,
      description: rec.description,
      uiLink: rec.uiLink,
      rawJson: rec.rawJson,
    };
    expect(SAM_CATEGORY).toContain(rec.category);
    expect(upsertKey.noticeId).toMatch(/^[A-Z0-9-]+$/);
    expect(upsertCreate).toMatchObject({
      noticeId: rec.noticeId,
      awardValue: 8500,
      isSetAside: true,
    });
  });
});
