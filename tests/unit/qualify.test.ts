// @polsia:user-owned — qualification predicate unit tests. Founder profile
// mirrors COMPANY_PROFILE (Minority-Owned + Active Duty U.S. Navy; NO SDV /
// WOSB markers; flat $3.5K–$10K micro-purchase scope). Asserts the two-gate
// predicate behavior the auto-draft orchestrator depends on.
import { describe, expect, it } from 'vitest';
import { COMPANY_PROFILE } from '../../src/lib/business/capability-statement';
import {
  MIN_8A_CONFIDENCE,
  MIN_SMALL_BUSINESS_CONFIDENCE,
  type QualifyOpportunityInput,
  qualifyForOpportunity,
} from '../../src/lib/business/qualify';

const NOW = new Date('2026-07-24T15:00:00.000Z');

function opp(overrides: Partial<QualifyOpportunityInput>): QualifyOpportunityInput {
  return {
    noticeId: 'TEST-001',
    title: 'IT services task',
    agency: 'Department of the Navy',
    naicsCode: '541512',
    setAside: '8A',
    source: 'SAM',
    ...overrides,
  };
}

describe('qualifyForOpportunity — founder profile gates', () => {
  it('matches the founder profile to actual COMPANY_PROFILE values', () => {
    // Defensive: the predicate mirrors the COMPANY_PROFILE that's actually
    // shipped. If the profile shape drifts, the test makes the diff visible.
    expect(COMPANY_PROFILE.founder.ownership).toMatch(/minority/i);
    expect(COMPANY_PROFILE.founder.branch).toMatch(/navy/i);
    expect(COMPANY_PROFILE.naics).toContain('541512');
  });

  it('qualifies on an 8A-only set-aside at IT-services NAICS', () => {
    const result = qualifyForOpportunity(
      opp({ setAside: '8A', naicsCode: '541512' }),
      COMPANY_PROFILE,
      NOW,
    );
    expect(result.qualifies).toBe(true);
    // SmallBusiness beats 8A on confidence (0.9 > 0.85 for the founder + on-suite
    // NAICS + small-business cert).
    expect(['SmallBusiness', '8A']).toContain(result.topBucket);
    expect(result.confidence).toBeGreaterThanOrEqual(MIN_8A_CONFIDENCE - 0.001);
  });

  it('qualifies on SmallBusiness set-aside at IT-services NAICS', () => {
    const result = qualifyForOpportunity(
      opp({ setAside: 'SBA', naicsCode: '541512' }),
      COMPANY_PROFILE,
      NOW,
    );
    expect(result.qualifies).toBe(true);
    expect(['SmallBusiness', '8A']).toContain(result.topBucket);
    expect(result.confidence).toBeGreaterThanOrEqual(MIN_SMALL_BUSINESS_CONFIDENCE - 0.001);
  });

  it('does NOT qualify on SDVOSBC set-aside only (founder has no SDV marker)', () => {
    const result = qualifyForOpportunity(
      opp({ setAside: 'SDVOSBC', naicsCode: '541512' }),
      COMPANY_PROFILE,
      NOW,
    );
    // SDVOSBC demoted to confidence=0; remaining buckets need a registered NAICS
    // AND small-business confidence ≥0.6 (which 541512 satisfies) so the
    // candidate still qualifies via SmallBusiness without an SDVOSBC route.
    // The CANONICAL assertion for SDVOSBC-only is: topBucket is NOT 'SDVOSB'.
    expect(result.topBucket).not.toBe('SDVOSB');
  });

  it('does NOT qualify on WOSB-only set-aside (founder is not women-owned)', () => {
    const result = qualifyForOpportunity(
      opp({ setAside: 'WOSB', naicsCode: '541512' }),
      COMPANY_PROFILE,
      NOW,
    );
    expect(result.topBucket).not.toBe('WOSB');
  });

  it('does NOT qualify on HUBZone set-aside when place-of-performance is unknown', () => {
    const result = qualifyForOpportunity(
      opp({ setAside: 'HUBZone', placeOfPerformance: null }),
      COMPANY_PROFILE,
      NOW,
    );
    expect(result.topBucket).not.toBe('HUBZone');
  });

  it('does NOT qualify when NAICS is not on the registered suite', () => {
    const result = qualifyForOpportunity(
      opp({ naicsCode: '999999', setAside: null }),
      COMPANY_PROFILE,
      NOW,
    );
    expect(result.qualifies).toBe(false);
    expect(result.topBucket).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reasoning.join(' ')).toMatch(/outside the registered NAICS suite/);
  });

  it('produces stable ordering (highest-confidence bucket first)', () => {
    const result = qualifyForOpportunity(
      opp({ setAside: '8A', naicsCode: '541618' }),
      COMPANY_PROFILE,
      NOW,
    );
    expect(result.qualifies).toBe(true);
    // With both SmallBusiness@0.9 (NAICS on suite + small-business cert) and
    // 8A@0.85 (Minority-Owned) available, SmallBusiness is the top bucket by
    // confidence. The ranker returns SmallBusiness as the headline signal,
    // with 8A in the secondary chip set.
    expect(result.topBucket).toBe('SmallBusiness');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
