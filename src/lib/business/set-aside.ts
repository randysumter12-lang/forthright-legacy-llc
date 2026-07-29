// @polsia:user-owned — pure set-aside qualification engine. No DB, no
// server-only, no Date.now() — accepts a `now?: Date` for determinism so
// unit tests run under jsdom without mocks. The ranker reads a normalized
// SetAsideOpportunity (NAICS, agency, place of performance) plus a build-time
// CompanyProfile and returns the buckets the company actually unlocks for
// the opportunity. Output rides the existing GET /api/sam-opportunities/<id>
// envelope as `qualifications`.
import type { CompanyProfile } from '@/lib/business/capability-statement';
import type {
  SetAsideBucket,
  SetAsideOpportunity,
  SetAsideQualification,
} from '@/lib/contracts/set-aside';

const SMALL_BUSINESS_MARKER = /small\s*business/i;
const SAM_REGISTERED_MARKER = /sam\.gov\s*registered|sam\s*registered/i;
const MINORITY_OWNED_MARKER = /minority[-\s]*owned/i;
const WOMEN_OWNED_MARKER = /women[-\s]*owned/i;
const SERVICE_DISABLED_VETERAN_MARKER = /service[-\s]*disabled\s*veteran|\bsdv\b/i;
const HUBZONE_PLACE_MARKER = /\bhubzone\b/i;

function profileHas(profile: CompanyProfile, marker: RegExp): boolean {
  return (
    profile.certifications.some((cert) => marker.test(cert)) ||
    marker.test(profile.founder.status) ||
    marker.test(profile.founder.ownership) ||
    marker.test(profile.founder.branch)
  );
}

function naicsMatches(profile: CompanyProfile, naicsCode: string): boolean {
  return profile.naics.some((code) => code === naicsCode);
}

function stableOrder(a: SetAsideQualification, b: SetAsideQualification): number {
  if (a.confidence !== b.confidence) return b.confidence - a.confidence;
  return a.bucket.localeCompare(b.bucket);
}

export function scoreSetAsideQualification(
  opportunity: SetAsideOpportunity,
  profile: CompanyProfile,
  _options: { now?: Date } = {},
): SetAsideQualification[] {
  const out: SetAsideQualification[] = [];

  const naicsMatchesProfile = naicsMatches(profile, opportunity.naicsCode);
  const hasSmallBusinessCert = profile.certifications.some((cert) =>
    SMALL_BUSINESS_MARKER.test(cert),
  );

  if (!naicsMatchesProfile) {
    out.push({
      bucket: 'SmallBusiness' satisfies SetAsideBucket,
      confidence: 0.4,
      reasoning: `NAICS ${opportunity.naicsCode} is outside the company's registered NAICS suite, dropping small-business confidence.`,
    });
  } else if (!hasSmallBusinessCert) {
    out.push({
      bucket: 'SmallBusiness' satisfies SetAsideBucket,
      confidence: 0.5,
      reasoning: `NAICS ${opportunity.naicsCode} is on the registered suite but the profile lacks a small-business certification marker.`,
    });
  } else {
    out.push({
      bucket: 'SmallBusiness' satisfies SetAsideBucket,
      confidence: 0.9,
      reasoning: `Company carries a small-business certification and NAICS ${opportunity.naicsCode} is on the registered suite.`,
    });
  }

  const isMinorityOwned = profileHas(profile, MINORITY_OWNED_MARKER);
  if (isMinorityOwned && naicsMatchesProfile) {
    out.push({
      bucket: '8A' satisfies SetAsideBucket,
      confidence: 0.85,
      reasoning: `Founder is Minority-Owned and NAICS ${opportunity.naicsCode} is on the registered suite, qualifying the 8(a) bucket.`,
    });
  }

  const isServiceDisabledVeteran = profileHas(profile, SERVICE_DISABLED_VETERAN_MARKER);
  if (isServiceDisabledVeteran) {
    out.push({
      bucket: 'SDVOSB' satisfies SetAsideBucket,
      confidence: 0.9,
      reasoning:
        'Founder carries a service-disabled-veteran status marker, making the SDVOSB bucket available.',
    });
  }

  const isWomenOwned = profileHas(profile, WOMEN_OWNED_MARKER);
  if (isWomenOwned) {
    out.push({
      bucket: 'WOSB' satisfies SetAsideBucket,
      confidence: 0.9,
      reasoning: 'Founder is women-owned, qualifying the WOSB bucket on this opportunity.',
    });
  }

  const pop = opportunity.placeOfPerformance ?? null;
  if (pop == null) {
    out.push({
      bucket: 'HUBZone' satisfies SetAsideBucket,
      confidence: 0.25,
      reasoning:
        'Place of performance is unknown (POP unknown); HUBZone is gated on geographic POP so confidence is reduced.',
    });
  } else if (HUBZONE_PLACE_MARKER.test(pop)) {
    out.push({
      bucket: 'HUBZone' satisfies SetAsideBucket,
      confidence: 0.85,
      reasoning: `Place of performance "${pop}" matches a known HUBZone designation.`,
    });
  } else {
    out.push({
      bucket: 'HUBZone' satisfies SetAsideBucket,
      confidence: 0.5,
      reasoning: `Place of performance "${pop}" is supplied but does not resolve to a HUBZone zone (capped at 0.5).`,
    });
  }

  const isSamRegistered = profileHas(profile, SAM_REGISTERED_MARKER);
  if (isSamRegistered) {
    out.push({
      bucket: 'SBA' satisfies SetAsideBucket,
      confidence: 0.6,
      reasoning:
        'Company is SAM.gov registered, qualifying SBA-level set-aside treatment on this notice.',
    });
  }

  return [...out].sort(stableOrder);
}
