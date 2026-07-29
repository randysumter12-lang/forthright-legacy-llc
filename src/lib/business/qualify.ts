// @polsia:user-owned — pure qualification predicate for the auto-draft
// orchestrator. Takes a normalized SamOpportunity envelope, a CompanyProfile,
// and a `now?: Date` so the test runner can freeze time. Returns a typed
// envelope describing whether the company qualifies for this opportunity,
// AND the top-qualifying bucket — the orchestrator uses that bucket as the
// short reason rendered on the dashboard chip.
//
// Two additive gates (NAICS-on-suite + minimum-confidence bucket) plus
// bucket-specific demotion rules for buckets the founder cannot satisfy
// (SDVOSB only, WOSB only, HUBZone without a known POP). The threshold
// constants are exported so tests + the orchestrator share a value.

import type { CompanyProfile } from '@/lib/business/capability-statement';
import { scoreSetAsideQualification } from '@/lib/business/set-aside';
import type { SetAsideBucket, SetAsideQualification } from '@/lib/contracts/set-aside';

export const MIN_8A_CONFIDENCE = 0.85;
export const MIN_SMALL_BUSINESS_CONFIDENCE = 0.6;
export const MIN_SBA_CONFIDENCE = 0.5;
const DEFAULT_MIN_CONFIDENCE = 0.6;

export interface QualifyOpportunityInput {
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  setAside: string | null;
  placeOfPerformance?: string | null;
  source?: 'SAM' | 'UNISON';
}

export type QualificationResult = {
  qualifies: boolean;
  topBucket: SetAsideBucket | null;
  confidence: number;
  reasoning: string[];
};

export function qualifyForOpportunity(
  opp: QualifyOpportunityInput,
  profile: CompanyProfile,
  now: Date = new Date(),
): QualificationResult {
  const qualifications: SetAsideQualification[] = scoreSetAsideQualification(
    {
      noticeId: opp.noticeId,
      title: opp.title,
      agency: opp.agency,
      naicsCode: opp.naicsCode,
      setAside: opp.setAside,
      placeOfPerformance: opp.placeOfPerformance ?? null,
    },
    profile,
    { now },
  );

  // Gate 1: NAICS must be on the registered suite. The founder cannot bid
  // on a NAICS that's not already registered — drop the candidate cleanly.
  const naicsMatches = profile.naics.some((code) => code === opp.naicsCode);
  if (!naicsMatches) {
    return {
      qualifies: false,
      topBucket: null,
      confidence: 0,
      reasoning: [
        `NAICS ${opp.naicsCode} is outside the registered NAICS suite — no qualification.`,
      ],
    };
  }

  // Gate 2: at least one qualifying bucket at the founder's profile-specific
  // minimum confidence. Buckets the founder cannot satisfy (SDVOSB without a
  // veteran marker, WOSB without a women-owned marker, HUBZone without a
  // resolved POP) are demoted: their confidence is reduced by an explicit
  // "not on profile" rule instead of using the ranker's optimistic value.
  const demoted = qualifications.map((q) =>
    demoteBucket(q, profile, opp.setAside, opp.placeOfPerformance ?? null),
  );

  // Sort by (1) confidence desc, (2) bucket specificity asc — 8A (>0.85) is a
  // stronger signal than SmallBusiness (>=0.6), so when both qualify we surface
  // 8A. Deterministic tie-break: bucket-specificity rank, then name.
  const specificity: Record<SetAsideBucket, number> = {
    '8A': 0,
    SmallBusiness: 1,
    SBA: 2,
    HUBZone: 3,
    SDVOSB: 4,
    WOSB: 5,
  };
  const sortable = [...demoted].sort((a, b) => {
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    const sa = specificity[a.bucket] ?? 99;
    const sb = specificity[b.bucket] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.bucket.localeCompare(b.bucket);
  });
  const top = sortable[0] ?? null;
  if (!top) {
    return { qualifies: false, topBucket: null, confidence: 0, reasoning: [] };
  }

  // Per-bucket minimum-confidence thresholds. The founder (Minority-Owned,
  // Active Duty U.S. Navy — no SDV/WOSB markers) is realistic for 8A +
  // SmallBusiness; SBA is included as a low-confidence bucket; everything
  // else never reaches the founder's profile.
  const meetsThreshold =
    bucketMeetsThreshold(top.bucket, top.confidence) &&
    (top.bucket === 'SDVOSB'
      ? false // founder has no SDV marker — explicit demotion final
      : top.bucket === 'WOSB'
        ? false // founder has no WOSB marker — explicit demotion final
        : top.bucket === 'HUBZone'
          ? top.confidence >= 0.8 // POP must resolve to a known HUBZone designation
          : true);

  const reasoning = [
    `${top.bucket} bucket qualifies at confidence ${top.confidence} on NAICS ${opp.naicsCode}.`,
    ...(demoted.length > 1
      ? [
          `Other evaluated buckets: ${demoted
            .filter((q) => q.bucket !== top.bucket)
            .map((q) => `${q.bucket}@${q.confidence}`)
            .join(', ')}.`,
        ]
      : []),
  ];

  return {
    qualifies: meetsThreshold,
    topBucket: meetsThreshold ? top.bucket : null,
    confidence: meetsThreshold ? top.confidence : 0,
    reasoning,
  };
}

function bucketMeetsThreshold(bucket: SetAsideBucket, confidence: number): boolean {
  switch (bucket) {
    case '8A':
      return confidence >= MIN_8A_CONFIDENCE;
    case 'SmallBusiness':
      return confidence >= MIN_SMALL_BUSINESS_CONFIDENCE;
    case 'SBA':
      return confidence >= MIN_SBA_CONFIDENCE;
    default:
      return confidence >= DEFAULT_MIN_CONFIDENCE;
  }
}

function demoteBucket(
  qualification: SetAsideQualification,
  profile: CompanyProfile,
  setAside: string | null,
  placeOfPerformance: string | null,
): SetAsideQualification {
  // Demote SDVOSB unless the founder carries a service-disabled-veteran marker.
  if (qualification.bucket === 'SDVOSB') {
    const hasMarker = /(?:^|\s|"|')service[-\s]?disabled[-\s]?veteran|\bsdv\b|sdvosb/i.test(
      `${profile.founder.status} ${profile.founder.branch} ${profile.founder.ownership} ${profile.certifications.join(' ')}`,
    );
    if (!hasMarker) {
      return {
        ...qualification,
        confidence: 0,
        reasoning:
          'Founder has no service-disabled-veteran marker — SDVOSB bucket is not satisfiable and demoted.',
      };
    }
  }
  // Demote WOSB unless the founder carries a women-owned marker.
  if (qualification.bucket === 'WOSB') {
    const hasMarker = /women[-\s]?owned/i.test(
      `${profile.founder.ownership} ${profile.certifications.join(' ')}`,
    );
    if (!hasMarker) {
      return {
        ...qualification,
        confidence: 0,
        reasoning:
          'Founder is not a women-owned small business — WOSB bucket is not satisfiable and demoted.',
      };
    }
  }
  // HUBZone gate when place-of-performance is unresolvable — only demote
  // for SOLICITATIONS whose set-aside explicitly names HUBZone. SDVOSBC
  // rows never HUBZone-qualify regardless.
  if (qualification.bucket === 'HUBZone') {
    const pop = placeOfPerformance ?? '';
    const setAsideMentionsHubzone = !!setAside && /\bhubzone\b/i.test(setAside);
    if (!pop || !setAsideMentionsHubzone) {
      return {
        ...qualification,
        confidence: 0,
        reasoning:
          'HUBZone requires an explicit place-of-performance designation AND a HUBZone-tagged set-aside; both must resolve.',
      };
    }
  }
  return qualification;
}
