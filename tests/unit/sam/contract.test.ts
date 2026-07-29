import { describe, expect, it } from 'vitest';
import {
  type SamOpportunityList as SamListModel,
  SamOpportunityItem,
  SamOpportunityList,
  SamOpportunityQuery,
  SamOpportunityTriggerResult,
} from '../../../src/lib/contracts/sam-opportunity';

const canonicalRow: SamListModel['items'][number] = {
  id: 'opp-1',
  noticeId: '36C10X-24-Q-0047',
  title: 'Network infrastructure upgrade',
  agency: 'Department of Veterans Affairs',
  naicsCode: '541512',
  dueDate: '2026-08-01T17:00:00.000Z',
  postedDate: '2026-07-18T12:00:00.000Z',
  awardValue: 8500,
  setAside: 'SDVOSBC',
  isSetAside: true,
  category: 'IT_SERVICES',
  description: null,
  uiLink: 'https://sam.gov/opp/36C10X-24-Q-0047',
  scrapedAt: '2026-07-20T01:13:09.000Z',
};

describe('SamOpportunityItem contract', () => {
  it('accepts a canonical row', () => {
    expect(() => SamOpportunityItem.parse(canonicalRow)).not.toThrow();
  });

  it('accepts all four category values', () => {
    for (const category of ['IT_SERVICES', 'CMMC', 'CONSULTING', 'OTHER']) {
      expect(() =>
        SamOpportunityItem.parse({ ...canonicalRow, noticeId: `id-${category}`, category }),
      ).not.toThrow();
    }
  });

  it('rejects an unknown category', () => {
    expect(() => SamOpportunityItem.parse({ ...canonicalRow, category: 'UNKNOWN' })).toThrow();
  });

  it('requires noticeId', () => {
    expect(() => SamOpportunityItem.parse({ ...canonicalRow, noticeId: '' })).toThrow();
  });

  it('rejects a malformed award value (string)', () => {
    // awardValue is z.number | null — a string must fail.
    expect(() =>
      SamOpportunityItem.parse({ ...canonicalRow, awardValue: 'not-a-number' as unknown }),
    ).toThrow();
  });

  it('tolerates missing optional dates and null description', () => {
    const parsed = SamOpportunityItem.parse({
      ...canonicalRow,
      dueDate: null,
      postedDate: null,
      description: null,
      setAside: null,
      isSetAside: false,
    });
    expect(parsed.dueDate).toBeNull();
    expect(parsed.description).toBeNull();
  });
});

describe('SamOpportunityList envelope', () => {
  it('round-trips an empty payload', () => {
    const parsed = SamOpportunityList.parse({ items: [] });
    expect(parsed.items).toEqual([]);
    expect(parsed.lastRun).toBeUndefined();
  });

  it('persists lastRun when provided', () => {
    const parsed = SamOpportunityList.parse({
      items: [canonicalRow],
      nextCursor: null,
      lastRun: {
        status: 'OK',
        startedAt: '2026-07-20T01:00:00.000Z',
        finishedAt: '2026-07-20T01:13:09.000Z',
        fetchedCount: 12,
        upsertedCount: 11,
        errorMessage: null,
        trigger: 'cron',
      },
    });
    expect(parsed.lastRun?.status).toBe('OK');
    expect(parsed.items).toHaveLength(1);
  });

  it('rejects an unknown lastRun status', () => {
    expect(() =>
      SamOpportunityList.parse({
        items: [],
        lastRun: { status: 'WHATEVER', startedAt: null, finishedAt: null },
      }),
    ).toThrow();
  });
});

describe('SamOpportunityTriggerResult envelope', () => {
  it('accepts an OK trigger result', () => {
    const parsed = SamOpportunityTriggerResult.parse({
      run: {
        id: 'run-1',
        status: 'OK',
        startedAt: '2026-07-20T01:00:00.000Z',
        finishedAt: '2026-07-20T01:13:09.000Z',
        fetchedCount: 4,
        upsertedCount: 4,
        errorMessage: null,
        trigger: 'manual',
      },
    });
    expect(parsed.run.trigger).toBe('manual');
  });

  it('accepts a rate-limited trigger result', () => {
    const parsed = SamOpportunityTriggerResult.parse({
      run: {
        id: 'run-2',
        status: 'RATE_LIMITED',
        startedAt: '2026-07-20T01:00:00.000Z',
        finishedAt: '2026-07-20T01:00:01.000Z',
        fetchedCount: 0,
        upsertedCount: 0,
        errorMessage: 'SAM.gov returned HTTP 429',
        trigger: 'cron',
      },
    });
    expect(parsed.run.status).toBe('RATE_LIMITED');
  });
});

describe('SamOpportunityQuery defaults', () => {
  it('defaults limit to 20 and accepts category-only filters', () => {
    const parsed = SamOpportunityQuery.parse({});
    expect(parsed.limit).toBe(20);
    const filtered = SamOpportunityQuery.parse({ category: 'CMMC' });
    expect(filtered.category).toBe('CMMC');
  });

  it('coerces string limit / setAside from URL query values', () => {
    const parsed = SamOpportunityQuery.parse({ limit: '5', setAside: 'true' });
    expect(parsed.limit).toBe(5);
    expect(parsed.setAside).toBe(true);
  });

  it('rejects a category outside the enum', () => {
    expect(() => SamOpportunityQuery.parse({ category: 'NOPE' })).toThrow();
  });
});
