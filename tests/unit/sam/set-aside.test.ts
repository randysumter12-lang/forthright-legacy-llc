// @polsia:user-owned — unit tests for the pure set-aside qualification
// engine. The ranker is jsdom-clean (no `server-only`, no `@/lib/db`), so the
// tests compose against canonical fixtures with no DB mocking. Mirrors the
// precedent set by capability-statement.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMPANY_PROFILE,
  type CompanyProfile,
} from '../../../src/lib/business/capability-statement';
import { scoreSetAsideQualification } from '../../../src/lib/business/set-aside';
import { SET_ASIDE_BUCKET, SetAsideOpportunity } from '../../../src/lib/contracts/set-aside';

const FROZEN_NOW = new Date('2026-07-20T13:00:00Z');

const CORE_OPP: import('../../../src/lib/contracts/set-aside').SetAsideOpportunity = {
  noticeId: '36C10X-24-Q-0047',
  title: 'Network infrastructure upgrade',
  agency: 'Department of the Navy',
  naicsCode: '541512',
  setAside: 'SDVOSBC',
  placeOfPerformance: null,
};

function variant(
  base: CompanyProfile,
  patch: Partial<{
    certifications: string[];
    founder: Partial<CompanyProfile['founder']>;
  }>,
): CompanyProfile {
  return {
    ...base,
    certifications: patch.certifications ?? [...base.certifications],
    founder: { ...base.founder, ...(patch.founder ?? {}) },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('module shape', () => {
  it('imports cleanly under jsdom (no server-only chain at module load)', async () => {
    const mod = await import('../../../src/lib/business/set-aside');
    expect(typeof mod.scoreSetAsideQualification).toBe('function');
    expect(SET_ASIDE_BUCKET).toContain('SmallBusiness');
    expect(SET_ASIDE_BUCKET).toContain('8A');
  });

  it('SetAsideOpportunity.parse round-trips the canonical fixture', () => {
    const parsed = SetAsideOpportunity.parse(CORE_OPP);
    expect(parsed.noticeId).toBe(CORE_OPP.noticeId);
    expect(parsed.naicsCode).toBe(CORE_OPP.naicsCode);
    expect(parsed.placeOfPerformance).toBeNull();
  });
});

describe('canonical Navy / Minority-Owned profile', () => {
  const qual = () => scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE);

  it('does NOT include SDVOSB or WOSB under the canonical profile', () => {
    const buckets = qual().map((entry) => entry.bucket);
    expect(buckets).not.toContain('SDVOSB');
    expect(buckets).not.toContain('WOSB');
  });

  it('returns SmallBusiness → 8A → SBA → HUBZone in stable rank order (confidence desc)', () => {
    expect(qual().map((entry) => entry.bucket)).toEqual(['SmallBusiness', '8A', 'SBA', 'HUBZone']);
  });

  it('keeps confidence non-increasing across the canonical buckets', () => {
    const confidences = qual().map((entry) => entry.confidence);
    for (let i = 1; i < confidences.length; i++) {
      const prev = confidences[i - 1];
      const curr = confidences[i];
      if (prev !== undefined && curr !== undefined) {
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    }
  });

  it('drops 8A entirely when NAICS is not in the profile naics suite', () => {
    const wrongNaics = { ...CORE_OPP, naicsCode: '999999' };
    const buckets = scoreSetAsideQualification(wrongNaics, COMPANY_PROFILE).map(
      (entry) => entry.bucket,
    );
    expect(buckets).not.toContain('8A');
  });

  it('returns SmallBusiness with the NAICS-mismatch reasoning', () => {
    const wrongNaics = { ...CORE_OPP, naicsCode: '999999' };
    const result = scoreSetAsideQualification(wrongNaics, COMPANY_PROFILE);
    const smallBusiness = result.find((entry) => entry.bucket === 'SmallBusiness');
    expect(smallBusiness).toBeDefined();
    if (smallBusiness) {
      expect(smallBusiness.confidence).toBeCloseTo(0.4, 5);
      expect(smallBusiness.reasoning.toLowerCase()).toContain('outside the company');
    }
  });

  it('drops SmallBusiness confidence to 0.5 when NAICS matches but no small-business certification marker', () => {
    const strippedCerts = COMPANY_PROFILE.certifications.filter(
      (cert) => !/small\s*business/i.test(cert),
    );
    const profileNoSB: CompanyProfile = { ...COMPANY_PROFILE, certifications: strippedCerts };
    const result = scoreSetAsideQualification(CORE_OPP, profileNoSB);
    const sb = result.find((entry) => entry.bucket === 'SmallBusiness');
    expect(sb?.confidence).toBeCloseTo(0.5, 5);
  });
});

describe('founder profile variants', () => {
  it('includes SDVOSB when the founder carries a service-disabled-veteran marker', () => {
    const sdvoProfile = variant(COMPANY_PROFILE, {
      founder: { ownership: 'Service-Disabled Veteran Owned Small Business' },
    });
    const result = scoreSetAsideQualification(CORE_OPP, sdvoProfile);
    expect(result.map((entry) => entry.bucket)).toContain('SDVOSB');
    expect(result.find((entry) => entry.bucket === 'SDVOSB')?.confidence).toBeCloseTo(0.9, 5);
  });

  it('includes WOSB when the founder carries a women-owned marker', () => {
    const wosbProfile = variant(COMPANY_PROFILE, {
      founder: { ownership: 'Women-Owned Small Business' },
    });
    const result = scoreSetAsideQualification(CORE_OPP, wosbProfile);
    expect(result.map((entry) => entry.bucket)).toContain('WOSB');
    expect(result.find((entry) => entry.bucket === 'WOSB')?.confidence).toBeCloseTo(0.9, 5);
  });
});

describe('agency exclusions', () => {
  it('does NOT auto-unlock SDVOSB on a Navy-favored opportunity unless the founder is SDV', () => {
    const navyOpp = { ...CORE_OPP, agency: 'Department of the Navy' };
    const buckets = scoreSetAsideQualification(navyOpp, COMPANY_PROFILE).map(
      (entry) => entry.bucket,
    );
    expect(buckets).not.toContain('SDVOSB');
  });

  it('omits SBA when the profile is not SAM.gov registered', () => {
    const noSamProfile: CompanyProfile = {
      ...COMPANY_PROFILE,
      certifications: COMPANY_PROFILE.certifications.filter(
        (cert) => !/sam\.gov\s*registered|sam\s*registered/i.test(cert),
      ),
    };
    const result = scoreSetAsideQualification(CORE_OPP, noSamProfile);
    expect(result.map((entry) => entry.bucket)).not.toContain('SBA');
  });
});

describe('place-of-performance gates HUBZone', () => {
  it('emits the low-confidence HUBZone entry with the POP-unknown reasoning when POP is null', () => {
    const result = scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE);
    const hub = result.find((entry) => entry.bucket === 'HUBZone');
    expect(hub?.confidence).toBeCloseTo(0.25, 5);
    expect(hub?.reasoning.toLowerCase()).toMatch(/pop\s+unknown|place of performance/);
  });

  it('promotes HUBZone confidence above 0.5 when POP matches a HUBZone designator', () => {
    const hubzoneOpp = {
      ...CORE_OPP,
      placeOfPerformance: 'Prince William County, VA — HUBZone tract',
    };
    const result = scoreSetAsideQualification(hubzoneOpp, COMPANY_PROFILE);
    const hub = result.find((entry) => entry.bucket === 'HUBZone');
    expect(hub?.confidence).toBeGreaterThan(0.5);
  });

  it('caps HUBZone confidence at 0.5 when POP is supplied but not a HUBZone', () => {
    const nonHubOp = { ...CORE_OPP, placeOfPerformance: 'Washington, DC' };
    const result = scoreSetAsideQualification(nonHubOp, COMPANY_PROFILE);
    const hub = result.find((entry) => entry.bucket === 'HUBZone');
    expect(hub?.confidence).toBeCloseTo(0.5, 5);
  });
});

describe('sorting stability', () => {
  it('sorts by confidence desc with bucket name as the tiebreaker', () => {
    const result = scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev && curr) {
        if (prev.confidence === curr.confidence) {
          expect(prev.bucket.localeCompare(curr.bucket)).toBeLessThanOrEqual(0);
        } else {
          expect(prev.confidence).toBeGreaterThan(curr.confidence);
        }
      }
    }
  });
});

describe('determinism', () => {
  it('produces deep-equal output for identical inputs (no Date.now or RNG)', () => {
    const a = scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE, { now: FROZEN_NOW });
    const b = scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE, { now: FROZEN_NOW });
    expect(a).toEqual(b);
  });

  it('does not mutate the input opportunity or profile', () => {
    const oppSnapshot = { ...CORE_OPP };
    const profileSnapshot = {
      ...COMPANY_PROFILE,
      certifications: [...COMPANY_PROFILE.certifications],
      naics: [...COMPANY_PROFILE.naics],
      setAsides: [...COMPANY_PROFILE.setAsides],
    };
    scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE, { now: FROZEN_NOW });
    expect(CORE_OPP).toEqual(oppSnapshot);
    expect(COMPANY_PROFILE).toEqual(profileSnapshot);
  });

  it('every entry is internally consistent (bucket in set, confidence in 0..1, non-empty reasoning)', () => {
    const result = scoreSetAsideQualification(CORE_OPP, COMPANY_PROFILE, { now: FROZEN_NOW });
    for (const entry of result) {
      expect(SET_ASIDE_BUCKET).toContain(entry.bucket);
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
      expect(typeof entry.reasoning).toBe('string');
      expect(entry.reasoning.length).toBeGreaterThan(0);
    }
  });
});
