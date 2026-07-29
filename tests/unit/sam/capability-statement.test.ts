// @polsia:user-owned — unit tests for the Capability Statement generator.
// The composition path is pure (no `server-only`/`@/lib/db`), so the tests
// can compose against canonical fixtures with no DB mocking. The orchestrator
// path is exercised through a vi.mock for @/lib/db so we can assert the
// prisma.upsert contract without round-tripping Postgres.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMPANY_PROFILE,
  composeCapabilityStatement,
  derivePolicyBadges,
  type SamOpportunityInput,
} from '../../../src/lib/business/capability-statement';
import {
  CapabilityStatement,
  type CapabilityStatementResult,
} from '../../../src/lib/contracts/capability-statement';

const IT_SERVICES_OPP: SamOpportunityInput = {
  id: 'opp-it-1',
  noticeId: '36C10X-24-Q-0047',
  title: 'Network infrastructure upgrade',
  agency: 'Department of Veterans Affairs',
  naicsCode: '541512',
  category: 'IT_SERVICES',
  setAside: 'SDVOSBC',
  dueDate: new Date('2026-08-01T17:00:00Z'),
  description: 'Upgrade routing/switching stack for VA regional office.',
  uiLink: 'https://sam.gov/opp/36C10X-24-Q-0047',
};

const CMMC_OPP: SamOpportunityInput = {
  id: 'opp-cmmc-1',
  noticeId: 'CMMC-001',
  title: 'CMMC gap assessment for DIB subcontractor',
  agency: 'DoD',
  naicsCode: '541690',
  category: 'CMMC',
  setAside: 'SBA',
  dueDate: new Date('2026-08-15T17:00:00Z'),
  description: null,
  uiLink: null,
};

const OTHER_OPP: SamOpportunityInput = {
  id: 'opp-other-1',
  noticeId: 'OTHER-001',
  title: 'Misc purchase',
  agency: 'USDA',
  naicsCode: '999999',
  category: 'OTHER',
  setAside: null,
  dueDate: null,
  description: null,
  uiLink: null,
};

const FROZEN_NOW = new Date('2026-07-20T13:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('COMPANY_PROFILE', () => {
  it('has the Navy + Minority-Owned badges as part of the founder record', () => {
    expect(COMPANY_PROFILE.founder.branch).toContain('Navy');
    expect(COMPANY_PROFILE.founder.ownership).toContain('Minority');
    expect(COMPANY_PROFILE.founder.status).toContain('Active Duty');
  });

  it('points its public contact route at the company inbox', () => {
    expect(COMPANY_PROFILE.contact.email).toBe('rigel-solutions@polsia.io');
    expect(COMPANY_PROFILE.contact.website).toMatch(/^https:\/\//);
  });
});

describe('derivePolicyBadges', () => {
  it('returns the canonical Navy + Minority-Owned pair in stable order', () => {
    const badges = derivePolicyBadges(COMPANY_PROFILE);
    expect(badges[0]).toBe('Active Duty U.S. Navy');
    expect(badges[1]).toBe('Minority-Owned');
  });
});

describe('composeCapabilityStatement — six body sections', () => {
  it('covers all six body sections plus a cover envelope', () => {
    const stmt = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    expect(stmt.cover).toBeDefined();
    for (const key of [
      'companyOverview',
      'coreCompetencies',
      'differentiators',
      'pastPerformance',
      'certifications',
      'contact',
    ] as const) {
      expect(stmt[key]).toBeDefined();
    }
  });

  it('embeds the typed CapabilityStatement contract — zod parse succeeds', () => {
    const stmt = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    expect(() => CapabilityStatement.parse(stmt)).not.toThrow();
  });
});

describe('badge injection', () => {
  it('injects Navy + Minority-Owned badges into cover.badges regardless of category', () => {
    for (const opp of [IT_SERVICES_OPP, CMMC_OPP, OTHER_OPP]) {
      const stmt = composeCapabilityStatement(opp, COMPANY_PROFILE, {
        generatedAt: FROZEN_NOW,
      });
      expect(stmt.cover.badges).toContain('Active Duty U.S. Navy');
      expect(stmt.cover.badges).toContain('Minority-Owned');
      expect(stmt.policyBadges).toContain('Active Duty U.S. Navy');
      expect(stmt.policyBadges).toContain('Minority-Owned');
    }
  });

  it('keeps Navy before Minority-Owned in cover.badges for any opportunity', () => {
    const stmt = composeCapabilityStatement(OTHER_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    const idxNavy = stmt.cover.badges.indexOf('Active Duty U.S. Navy');
    const idxMinority = stmt.cover.badges.indexOf('Minority-Owned');
    expect(idxNavy).toBeGreaterThanOrEqual(0);
    expect(idxMinority).toBeGreaterThan(idxNavy);
  });

  it('appends the opportunity category label as a non-policy badge', () => {
    const stmt = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    expect(stmt.cover.badges).toContain('IT Services');
  });
});

describe('category-specific core competency selection', () => {
  it('picks IT-services-flavored competencies for an IT_SERVICES opportunity', () => {
    const stmt = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    const joined = stmt.coreCompetencies.items
      .map((item) => `${item.name} ${item.description}`.toLowerCase())
      .join(' | ');
    expect(joined).toMatch(/(cloud|network|devsecops|endpoint|identity|it|system|zero[- ]?trust)/);
  });

  it('picks CMMC-flavored competencies for a CMMC opportunity', () => {
    const stmt = composeCapabilityStatement(CMMC_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    const joined = stmt.coreCompetencies.items
      .map((item) => `${item.name} ${item.description}`.toLowerCase())
      .join(' | ');
    expect(joined).toMatch(/(cmmc|nist|cui|gap|ssp|poa&m|maturity)/);
  });

  it('falls back to a narrow RESEARCH competency for OTHER-category NAICS', () => {
    const stmt = composeCapabilityStatement(OTHER_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    expect(stmt.coreCompetencies.items.length).toBeGreaterThanOrEqual(1);
    expect(stmt.coreCompetencies.items[0]).toBeDefined();
  });
});

describe('determinism', () => {
  it('produces identical output for identical inputs (no Date.now or RNG)', () => {
    const a = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    const b = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    expect(a).toEqual(b);
  });

  it('embeds the supplied generatedAt timestamp verbatim', () => {
    const stmt = composeCapabilityStatement(IT_SERVICES_OPP, COMPANY_PROFILE, {
      generatedAt: FROZEN_NOW,
    });
    expect(stmt.generatedAt).toBe(FROZEN_NOW.toISOString());
  });
});

describe('generateCapabilityStatement orchestrator', () => {
  it('upserts a CapabilityStatement row tied to the SamOpportunity id', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'cap-1' });
    const findUnique = vi.fn().mockResolvedValue({
      id: IT_SERVICES_OPP.id,
      noticeId: IT_SERVICES_OPP.noticeId,
      title: IT_SERVICES_OPP.title,
      agency: IT_SERVICES_OPP.agency,
      naicsCode: IT_SERVICES_OPP.naicsCode,
      category: IT_SERVICES_OPP.category,
      setAside: IT_SERVICES_OPP.setAside,
      dueDate: IT_SERVICES_OPP.dueDate,
      description: IT_SERVICES_OPP.description,
      uiLink: IT_SERVICES_OPP.uiLink,
    });
    vi.doMock('@/lib/db', () => ({
      prisma: { samOpportunity: { findUnique }, capabilityStatement: { upsert } },
    }));

    const mod = await import('../../../src/lib/business/capability-statement');
    const result: CapabilityStatementResult | null = await mod.generateCapabilityStatement(
      IT_SERVICES_OPP.id,
      { now: FROZEN_NOW },
    );

    expect(result).not.toBeNull();
    expect(result?.samOpportunityId).toBe(IT_SERVICES_OPP.id);
    expect(result?.statement.cover.companyName).toBe(COMPANY_PROFILE.name);
    expect(result?.statement.policyBadges).toEqual(['Active Duty U.S. Navy', 'Minority-Owned']);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: IT_SERVICES_OPP.id } });
    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = upsert.mock.calls[0]?.[0] as {
      where: { samOpportunityId: string };
      create: { samOpportunityId: string; fullDocument: unknown };
      update: { fullDocument: unknown };
    };
    expect(upsertArgs.where.samOpportunityId).toBe(IT_SERVICES_OPP.id);
    expect(upsertArgs.create.samOpportunityId).toBe(IT_SERVICES_OPP.id);
    expect(() => CapabilityStatement.parse(upsertArgs.create.fullDocument)).not.toThrow();
    expect(() => CapabilityStatement.parse(upsertArgs.update.fullDocument)).not.toThrow();
    vi.doUnmock('@/lib/db');
  });

  it('returns null when the SamOpportunity id has no row', async () => {
    const upsert = vi.fn();
    const findUnique = vi.fn().mockResolvedValue(null);
    vi.doMock('@/lib/db', () => ({
      prisma: { samOpportunity: { findUnique }, capabilityStatement: { upsert } },
    }));

    const mod = await import('../../../src/lib/business/capability-statement');
    const result = await mod.generateCapabilityStatement('missing-id', {
      now: FROZEN_NOW,
    });
    expect(result).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
    vi.doUnmock('@/lib/db');
  });
});
