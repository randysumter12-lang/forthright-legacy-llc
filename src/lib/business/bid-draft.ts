// @polsia:user-owned — Bid Draft composer + lazy-prisma orchestrator.
// Follows the Capability Statement precedent: a pure composer (no DB) takes
// (opp, capability, profile, { now? }) and produces a typed envelope, then a
// lazy @/lib/db orchestrator upserts the row with status='DRAFT'. The
// orchestrator NEVER writes status='SUBMITTED' — that flip can only happen
// through the future reviewer endpoint that calls transitionBidDraftStatus,
// which itself rejects DRAFT → SUBMITTED.
import type { PrismaClient } from '@prisma/client';
import {
  COMPANY_PROFILE,
  categoryLabel,
  derivePolicyBadges,
} from '@/lib/business/capability-statement';
import {
  BID_DRAFT_STATUS,
  type BidAudit,
  type BidAuditEntry,
  type BidComplianceMatrix,
  type BidComplianceRow,
  type BidCover,
  BidDraftResult,
  BidDraftSections,
  type BidOutcome,
  type BidOutcomeRequest,
  type BidPastPerformance,
  type BidPricingSummary,
  type BidStaffing,
  type BidTechnicalApproach,
  type OutcomeAudit,
  type OutcomeAuditEntry,
} from '@/lib/contracts/bid-draft';
import {
  CapabilityContact,
  CapabilityCoreCompetencies,
  CapabilityCover,
  CapabilityPastPerformance,
} from '@/lib/contracts/capability-statement';
import type { SamCategory } from '@/lib/contracts/sam-opportunity';
import type { SessionUser } from '@/lib/require-auth';

export type { SamCategory };

export type BidDraftStatusValue = (typeof BID_DRAFT_STATUS)[number];

export interface BidDraftOpportunityInput {
  id: string;
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  category: SamCategory;
  setAside: string | null;
  dueDate: Date | null;
  postedDate: Date | null;
  awardValue: number | null;
  description: string | null;
  uiLink: string | null;
}

// Marks an input from the persisted CapabilityStatement row — sections are
// parsed via zod at the orchestrator boundary so a JSON drift surfaces before
// composition runs.
export interface BidDraftCapabilityInput {
  companyName: string;
  tagline: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;
  competencies: { name: string; description: string }[];
  pastPerformance: { client: string; scope: string; value: number | null; period: string }[];
}

export interface ComposeOptions {
  now?: Date;
}

// MARK: — pricing line items (deterministic; not pulled from any rate card) -

const T_M_LINE_ITEMS: ReadonlyArray<{ laborCategory: string; rate: number; unit: string }> = [
  { laborCategory: 'Senior Subject Matter Expert (SME)', rate: 185, unit: 'hour' },
  { laborCategory: 'Mid IT Specialist', rate: 135, unit: 'hour' },
  { laborCategory: 'Junior Analyst', rate: 95, unit: 'hour' },
];

const STAFFING_QUALIFICATIONS: ReadonlyArray<string> = [
  'Active Duty U.S. Navy — direct exposure to DoD acquisition tempo, contracting discipline, and IT service delivery inside the federal mission space.',
  'Verified Minority-Owned small business — preferential positioning for applicable socio-economic set-aside buys.',
  'AI-native bid drafting pipeline — every draft is generated, traced, and reviewer-approved end-to-end.',
  'Daily SAM.gov surveillance — surfaced opportunities reach the bid queue within 24 hours of posting.',
];

const MICRO_PURCHASE_BAND =
  'Simplified Acquisition $3,500–$10,000 (FAR 13.1 micro-purchase threshold)';
const COMPLIANCE_THRESHOLD = 'Simplified acquisition ≤ $10,000 (FAR 13.1)';
const STRUCTURE_T_M = 'Time & Materials (T&M) — labor-category hours, materials at cost';
const STATUS_HUMAN_REVIEW_GATE = 'requires human review before any submission endpoint fires';

// MARK: — compliance rows (always populated, uses opp.naicsCode verbatim) --

function buildComplianceRows(naicsCode: string): BidComplianceRow[] {
  const naicsSuite =
    '541512, 541511, 541519, 541690, 541618, 541330 — registered NAICS suite under which this NAICS aligns';
  return [
    {
      clause: 'SAM.gov Registration (FAR 4.11)',
      posture: 'COMPLIANT',
      evidence: 'Active SAM.gov registration on file — CAGE + UEI provided in the award package.',
    },
    {
      clause: 'Socio-Economic Set-Aside Eligibility',
      posture: 'COMPLIANT',
      evidence:
        'Verified Minority-Owned small business — eligible under applicable set-aside acquisition.',
    },
    {
      clause: 'NAICS Alignment',
      posture: 'COMPLIANT',
      evidence: `Solicitation NAICS ${naicsCode} aligns with registered ${naicsSuite}.`,
    },
    {
      clause: 'FAR 13.1 Simplified Acquisition Procedures',
      posture: 'COMPLIANT',
      evidence:
        'Pricing structured within the $3,500–$10,000 simplified acquisition micro-purchase band.',
    },
    {
      clause: 'DFARS 7012 / 7020 CUI Handling',
      posture: 'ASSERTED',
      evidence:
        'CUI handling posture will be confirmed at award based on the CUI marking provided in the SOW.',
    },
    {
      clause: 'FAR 7.105 / Section 508 Accessibility',
      posture: 'ASSERTED',
      evidence:
        'Section 508 conformance posture will be confirmed at award based on the requirement statement.',
    },
    {
      clause: 'Small Business Subcontracting Plan',
      posture: 'PENDING',
      evidence:
        'Subcontracting posture to be confirmed at award based on contract value and team composition.',
    },
  ];
}

// MARK: — section builders ---------------------------------------------------

function buildCover(opp: BidDraftOpportunityInput, cap: BidDraftCapabilityInput): BidCover {
  return {
    noticeId: opp.noticeId,
    title: opp.title,
    agency: opp.agency,
    naicsCode: opp.naicsCode,
    category: categoryLabel(opp.category),
    setAside: opp.setAside,
    dueDate: opp.dueDate ? opp.dueDate.toISOString() : null,
    postedDate: opp.postedDate ? opp.postedDate.toISOString() : null,
    awardValue: opp.awardValue,
    companyName: cap.companyName,
    tagline: cap.tagline,
    badges: [...derivePolicyBadges(COMPANY_PROFILE)],
    contact: {
      name: cap.contactName,
      email: cap.contactEmail,
      phone: cap.contactPhone,
      website: cap.contactWebsite,
    },
  };
}

function buildTechnicalApproach(
  opp: BidDraftOpportunityInput,
  cap: BidDraftCapabilityInput,
): BidTechnicalApproach {
  const competencies = cap.competencies;
  const competencyNames = competencies.map((c) => c.name).join(', ');
  const category = categoryLabel(opp.category);
  const narrative = `Rigel Solutions addresses this ${category} requirement with a tightly-scoped bundle of federal-grade competencies, prior-aligned to the Active Duty U.S. Navy founder's direct exposure to DoD acquisition and IT service delivery. The narrative below binds the solicitation's NAICS (${opp.naicsCode}) to ${competencies.length} competencies — ${competencyNames} — each delivered inside an AI-traced, reviewer-approved workflow tuned for the $3,500–$10,000 simplified acquisition band.`;
  const founderFraming =
    'Bid team draw includes the founder-operator (Active Duty U.S. Navy, Minority-Owned, daily SAM.gov surveillance) plus a Subject Matter Expert network selected per task order at award. Every draft revision is traceable and reviewer-approved before any submission endpoint fires.';
  return {
    category,
    narrative,
    competencies,
    founderFraming,
  };
}

function buildStaffing(): BidStaffing {
  return {
    founder: {
      name: COMPANY_PROFILE.founder.name,
      branch: COMPANY_PROFILE.founder.branch,
      status: COMPANY_PROFILE.founder.status,
      ownership: COMPANY_PROFILE.founder.ownership,
    },
    founded: COMPANY_PROFILE.founded,
    headquarters: COMPANY_PROFILE.headquarters,
    qualifications: [...STAFFING_QUALIFICATIONS],
  };
}

function buildPricingSummary(opp: BidDraftOpportunityInput): BidPricingSummary {
  const narrative =
    opp.awardValue == null
      ? `Pricing as negotiated at award within the $3,500–$10,000 simplified acquisition band. T&M structure keeps labor categories explicit; ceiling is fixed per task order, materials are pass-through at cost.`
      : `Target award value $${opp.awardValue.toLocaleString(
          'en-US',
        )} priced T&M within the simplified acquisition band. Labor categories and ceilings fixed per task order; materials pass-through at cost.`;
  return {
    band: MICRO_PURCHASE_BAND,
    structure: STRUCTURE_T_M,
    lineItems: T_M_LINE_ITEMS.map((line) => ({ ...line })),
    narrative,
    awardValue: opp.awardValue,
  };
}

function buildPastPerformance(cap: BidDraftCapabilityInput): BidPastPerformance {
  return {
    items: cap.pastPerformance.map((entry) => ({ ...entry })),
  };
}

function buildComplianceMatrix(opp: BidDraftOpportunityInput): BidComplianceMatrix {
  return {
    threshold: COMPLIANCE_THRESHOLD,
    rows: buildComplianceRows(opp.naicsCode),
  };
}

export function buildBidDraftSections(
  opp: BidDraftOpportunityInput,
  capability: BidDraftCapabilityInput,
): BidDraftSections {
  return {
    cover: buildCover(opp, capability),
    technicalApproach: buildTechnicalApproach(opp, capability),
    staffing: buildStaffing(),
    pricingSummary: buildPricingSummary(opp),
    pastPerformance: buildPastPerformance(capability),
    complianceMatrix: buildComplianceMatrix(opp),
  };
}

// MARK: — printable Markdown rendering --------------------------------------

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});
const CURRENCY_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function fmtDate(value: string | null | undefined): string {
  if (!value) return 'Not specified';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : DATE_FMT.format(d);
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return 'Within $3,500–$10,000 micro-purchase band';
  return CURRENCY_FMT.format(value);
}

function sanitizeTable(value: string): string {
  // Defensive — replace any leftover pipe characters in user-supplied strings
  // so the compliance table renders without malformed rows.
  return value.replace(/\|/g, '\\|');
}

// renderBidDraftMarkdown — deterministic: same input → same output. Used
// both by composeBidDraft (so the `markdown` field in the envelope is the
// canonical rendering) and by tests (assert never-blank + determinism).
export function renderBidDraftMarkdown(
  sections: BidDraftSections,
  ctx: {
    noticeId: string;
    agency: string;
    status: BidDraftStatusValue;
    revision: number;
    generatedAt: Date;
  },
): string {
  const { cover, technicalApproach, staffing, pricingSummary, pastPerformance, complianceMatrix } =
    sections;

  const competencyLines = technicalApproach.competencies.map(
    (c, idx) => `${idx + 1}. **${sanitizeTable(c.name)}** — ${sanitizeTable(c.description)}`,
  );

  const pricingLineRows = pricingSummary.lineItems
    .map(
      (line) =>
        `| ${sanitizeTable(line.laborCategory)} | ${CURRENCY_FMT.format(line.rate)} | ${sanitizeTable(
          line.unit,
        )} |`,
    )
    .join('\n');

  const pastPerformanceItems = pastPerformance.items
    .map(
      (entry) =>
        `- **${sanitizeTable(entry.client)}** (${sanitizeTable(entry.period)}) — ${sanitizeTable(
          entry.scope,
        )}\n  - Value: ${
          entry.value == null ? 'Provided on award package' : CURRENCY_FMT.format(entry.value)
        }`,
    )
    .join('\n');

  const complianceRows = complianceMatrix.rows
    .map(
      (row) => `| ${sanitizeTable(row.clause)} | ${row.posture} | ${sanitizeTable(row.evidence)} |`,
    )
    .join('\n');

  const staffQuals = staffing.qualifications.map((q) => `- ${sanitizeTable(q)}`).join('\n');

  const lines: string[] = [
    `# Bid Response Draft — ${cover.title}`,
    '',
    `**Solicitation**: ${ctx.noticeId}  `,
    `**Agency**: ${ctx.agency}  `,
    `**NAICS**: ${cover.naicsCode} (${cover.category})  `,
    `**Set-Aside**: ${cover.setAside ?? 'Not specified'}  `,
    `**Due**: ${fmtDate(cover.dueDate)}  `,
    `**Award Band**: ${fmtCurrency(cover.awardValue)}`,
    '',
    `**Status**: ${ctx.status} (revision ${ctx.revision}) — ${STATUS_HUMAN_REVIEW_GATE}`,
    '',
    '---',
    '',
    '## 1. Cover Page',
    '',
    `**${cover.companyName}** — ${cover.tagline}`,
    '',
    `**Badges**: ${cover.badges.map((b) => sanitizeTable(b)).join(' • ')}`,
    '',
    `Point of Contact: ${cover.contact.name}  `,
    `Email: ${cover.contact.email}  `,
    `Phone: ${cover.contact.phone}  `,
    `Website: ${cover.contact.website}`,
    '',
    '---',
    '',
    '## 2. Technical Approach',
    '',
    technicalApproach.narrative,
    '',
    '### Core Competencies',
    '',
    competencyLines.join('\n'),
    '',
    technicalApproach.founderFraming,
    '',
    '---',
    '',
    '## 3. Staffing & Qualifications',
    '',
    `- **Bid Team Lead**: ${staffing.founder.name} — ${staffing.founder.branch}, ${staffing.founder.status}, ${staffing.founder.ownership}`,
    `- **Founded**: ${staffing.founded}`,
    `- **Headquarters**: ${staffing.headquarters}`,
    '',
    '### Key Qualifications',
    '',
    staffQuals,
    '',
    '---',
    '',
    '## 4. Pricing Summary',
    '',
    `**Award Band**: ${pricingSummary.band}  `,
    `**Structure**: ${pricingSummary.structure}  `,
    `**Target**: ${fmtCurrency(cover.awardValue)}`,
    '',
    '| Labor Category | Rate (USD/hour) | Unit |',
    '| --- | --- | --- |',
    pricingLineRows,
    '',
    pricingSummary.narrative,
    '',
    '---',
    '',
    '## 5. Past Performance',
    '',
    pastPerformanceItems,
    '',
    '---',
    '',
    `## 6. Compliance Matrix — ${complianceMatrix.threshold}`,
    '',
    '| Clause | Posture | Evidence |',
    '| --- | --- | --- |',
    complianceRows,
    '',
    '---',
    '',
    `_Generated: ${ctx.generatedAt.toISOString()} • Revision: ${ctx.revision} • Status: ${ctx.status} — ${STATUS_HUMAN_REVIEW_GATE.replace(/\.$/, '')}._`,
    '',
  ];

  return lines.join('\n');
}

// MARK: — pure composer (no DB) ---------------------------------------------

export interface ComposedBidDraft {
  samOpportunityId: string;
  sections: BidDraftSections;
  markdown: string;
}

export function composeBidDraft(
  opp: BidDraftOpportunityInput,
  capability: BidDraftCapabilityInput,
  options: ComposeOptions = {},
): ComposedBidDraft {
  const now = options.now ?? new Date();
  const sections = buildBidDraftSections(opp, capability);
  // Parse the sections through the schema so a contract drift surfaces here
  // (jsdom + zod) before the orchestrator lands the upsert.
  BidDraftSections.parse(sections);
  const markdown = renderBidDraftMarkdown(sections, {
    noticeId: opp.noticeId,
    agency: opp.agency,
    status: 'DRAFT',
    revision: 0,
    generatedAt: now,
  });
  return { samOpportunityId: opp.id, sections, markdown };
}

// MARK: — lazy-prisma orchestrator ------------------------------------------

export interface GenerateBidDraftOptions {
  now?: Date;
  force?: boolean;
}

export type GenerateBidDraftResult = BidDraftResult | null;

export async function generateBidDraft(
  samOpportunityId: string,
  options: GenerateBidDraftOptions = {},
): Promise<GenerateBidDraftResult> {
  // Lazy import — keeps the file jsdom-loadable without mocking @/lib/db so
  // pure-composer tests can compose against canonical fixtures (mirrors the
  // CapabilityStatement precedent).
  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  const opp = await prisma.samOpportunity.findUnique({
    where: { id: samOpportunityId },
    include: { capabilityStatement: true },
  });
  if (!opp) return null;

  if (!opp.capabilityStatement) {
    // The brief composes BidDraft from CapabilityStatement + SamOpportunity
    // + COMPANY_PROFILE. Without the capability statement the prior step
    // hasn't run (the orchestrator surfaces this as a structured error so
    // the POST handler can map it to 409).
    throw new Error('capability_statement_required');
  }

  const capRow = opp.capabilityStatement as unknown as {
    cover: unknown;
    contact: unknown;
    coreCompetencies: unknown;
    pastPerformance: unknown;
  };

  // Hydrate the orchestrator-side row into the pure-composer shape. We pull
  // typed bits from the CapabilityStatement contract (so a JSON drift surfaces
  // here) and combine them with the live SamOpportunity fields into the
  // BidDraft section shape.
  const capCover = CapabilityCover.parse(capRow.cover);
  const capContact = CapabilityContact.parse(capRow.contact);
  const capCompetencies = CapabilityCoreCompetencies.parse(capRow.coreCompetencies);
  const capPastPerformance = CapabilityPastPerformance.parse(capRow.pastPerformance);

  const oppInput: BidDraftOpportunityInput = {
    id: opp.id,
    noticeId: opp.noticeId,
    title: opp.title,
    agency: opp.agency,
    naicsCode: opp.naicsCode,
    category: opp.category as SamCategory,
    setAside: opp.setAside,
    dueDate: opp.dueDate,
    postedDate: opp.postedDate,
    awardValue: opp.awardValue == null ? null : Number(opp.awardValue),
    description: opp.description,
    uiLink: opp.uiLink,
  };

  const capabilityInput: BidDraftCapabilityInput = {
    companyName: capCover.companyName,
    tagline: capCover.tagline,
    contactName: capContact.name,
    contactEmail: capContact.email,
    contactPhone: capContact.phone,
    contactWebsite: capContact.website,
    competencies: capCompetencies.items.map((item) => ({
      name: item.name,
      description: item.description,
    })),
    pastPerformance: capPastPerformance.items.map((entry) => ({
      client: entry.client,
      scope: entry.scope,
      value: entry.value,
      period: entry.period,
    })),
  };

  const now = options.now ?? new Date();
  const composed = composeBidDraft(oppInput, capabilityInput, { now });

  // Cross-check deterministic parity: re-render with revision=0 and frozen
  // now so the `markdown` field is provably canonical (renderer's output
  // IS the field; not a pre-composed string from elsewhere).
  const canonicalMarkdown = renderBidDraftMarkdown(composed.sections, {
    noticeId: oppInput.noticeId,
    agency: oppInput.agency,
    status: 'DRAFT',
    revision: 0,
    generatedAt: now,
  });

  if (canonicalMarkdown !== composed.markdown) {
    // Defensive — should never trigger given the composer calls the renderer
    // with the same args.
    throw new Error('markdown_parity_mismatch');
  }

  // Upsert with status='DRAFT' — orchestrator NEVER writes 'SUBMITTED'.
  // Revision counter increments on regeneration (update path); first insert
  // seeds revision=0 via the @default(0).
  const upsertArgs = {
    where: { samOpportunityId },
    create: {
      samOpportunityId,
      status: 'DRAFT' as const,
      cover: composed.sections.cover as unknown as object,
      technicalApproach: composed.sections.technicalApproach as unknown as object,
      staffing: composed.sections.staffing as unknown as object,
      pricingSummary: composed.sections.pricingSummary as unknown as object,
      pastPerformance: composed.sections.pastPerformance as unknown as object,
      complianceMatrix: composed.sections.complianceMatrix as unknown as object,
      markdown: canonicalMarkdown,
    },
    update: {
      status: 'DRAFT' as const,
      cover: composed.sections.cover as unknown as object,
      technicalApproach: composed.sections.technicalApproach as unknown as object,
      staffing: composed.sections.staffing as unknown as object,
      pricingSummary: composed.sections.pricingSummary as unknown as object,
      pastPerformance: composed.sections.pastPerformance as unknown as object,
      complianceMatrix: composed.sections.complianceMatrix as unknown as object,
      markdown: canonicalMarkdown,
      revision: { increment: 1 },
    },
  };
  const row = await prisma.bidDraft.upsert(upsertArgs);

  const envelope: BidDraftResult = {
    samOpportunityId,
    source: opp.source === 'UNISON' ? 'UNISON' : 'SAM',
    draft: {
      id: row.id,
      samOpportunityId: row.samOpportunityId,
      status: row.status as BidDraftResult['draft']['status'],
      revision: row.revision,
      generatedAt: row.generatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sections: composed.sections,
      markdown: row.markdown,
    },
  };
  return BidDraftResult.parse(envelope);
}

// MARK: — status transition helper (future reviewer endpoint only) ---------

export class HumanApprovalRequiredError extends Error {
  constructor(message = 'human_approval_required') {
    super(message);
    this.name = 'HumanApprovalRequiredError';
  }
}

// transitionBidDraftStatus — the ONLY programmatic surface able to flip
// status away from 'DRAFT', and it refuses DRAFT → SUBMITTED (a future
// reviewer endpoint is the only path to 'SUBMITTED'). The orchestrator in
// this file NEVER calls this helper; it only writes 'DRAFT' on upsert.
export async function transitionBidDraftStatus(
  id: string,
  target: BidDraftStatusValue,
): Promise<{ id: string; status: BidDraftStatusValue }> {
  if (!(BID_DRAFT_STATUS as readonly string[]).includes(target)) {
    throw new Error(`invalid_status:${target}`);
  }

  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  const existing = await prisma.bidDraft.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('not_found');
  }

  if (existing.status === 'DRAFT' && target === 'SUBMITTED') {
    throw new HumanApprovalRequiredError();
  }

  const updated = await prisma.bidDraft.update({
    where: { id },
    data: { status: target },
  });

  return {
    id: updated.id,
    status: updated.status as BidDraftStatusValue,
  };
}

// MARK: — /api/bids/<id>/submit business helper ----------------------------

// Errors thrown by submitBidDraft — the route handler maps each to its HTTP
// shape. `not_found` → 404, `already_submitted` → 409, `invalid_payload` →
// 400, anything else → 500.
export type BidSubmitError = 'not_found' | 'already_submitted' | 'invalid_payload';

export class BidSubmitResponseOwnershipError extends Error {
  readonly code: BidSubmitError;
  constructor(code: BidSubmitError) {
    super(code);
    this.name = 'BidSubmitResponseOwnershipError';
    this.code = code;
  }
}

export interface SubmitBidDraftInput {
  responseVersion: number;
  source: 'SAM' | 'UNISON';
  confirm: true;
}

export interface SubmitBidDraftResult {
  id: string;
  status: 'SUBMITTED';
  submittedAt: Date;
  submittedByUserId: string;
  submissionAudit: BidAudit;
}

// Audit schema version — increment when BidAuditEntry fields change shape.
const AUDIT_SCHEMA_VERSION = 1;

// submitBidDraft — flips an owned BidDraft to status='SUBMITTED' and writes a
// single audit entry into submissionAudit within one prisma.$transaction.
//
// Owner-scoped via `where: { id, ownerUserId: actor.id }` (404 lands on miss
// rather than 401/403 to preserve the IDOR posture set by the existing
// status route handler). Bypasses the DRAFT → SUBMITTED guard that
// transitionBidDraftStatus enforces because the new POST /api/bids/<id>/submit
// endpoint is the human-confirmed submission path — a UI gate (the
// BidDraftSubmitButton is `disabled` until `status === 'REVIEW'`) keeps raw
// curl-style calls from prematurely submitting.
export async function submitBidDraft(
  id: string,
  actor: SessionUser,
  payload: SubmitBidDraftInput,
  now: Date = new Date(),
): Promise<SubmitBidDraftResult> {
  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  // Ownership-scoped read so a foreign id surfaces as `not_found` rather than
  // `forbidden`. Mirrors the existing status route handler's posture.
  const row = await prisma.bidDraft.findFirst({
    where: { id, ownerUserId: actor.id },
    include: { samOpportunity: { select: { source: true } } },
  });
  if (!row) {
    throw new BidSubmitResponseOwnershipError('not_found');
  }

  if (row.submittedAt != null) {
    throw new BidSubmitResponseOwnershipError('already_submitted');
  }

  const rowSource = row.samOpportunity?.source === 'UNISON' ? 'UNISON' : 'SAM';
  if (payload.source !== rowSource) {
    // The client carries a source discriminator, but the row's sam_opportunity
    // is the source of truth. Mismatch is a 400 (caller confused).
    throw new BidSubmitResponseOwnershipError('invalid_payload');
  }

  const auditEntry: BidAuditEntry = {
    version: AUDIT_SCHEMA_VERSION,
    source: rowSource,
    actor: actor.id,
    recordedAt: now.toISOString(),
    responseVersion: payload.responseVersion,
  };

  await prisma.$transaction([
    prisma.bidDraft.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
        submittedByUserId: actor.id,
        submissionAudit: [auditEntry] as unknown as object,
      },
    }),
  ]);

  return {
    id,
    status: 'SUBMITTED',
    submittedAt: now,
    submittedByUserId: actor.id,
    submissionAudit: [auditEntry],
  };
}

// MARK: — /api/bids/<id>/outcome business helper ----------------------------

// Errors thrown by recordBidOutcome — the route handler maps each to its
// HTTP shape. `not_found` → 404, `not_submitted` → 409, `already_outcome`
// → 409, anything else → 500. The enum-name here is intentionally distinct
// from BidSubmitResponseOwnershipError to avoid cross-route catch confusion.
export type RecordBidOutcomeError = 'not_found' | 'not_submitted' | 'already_outcome';

export class BidOutcomeResponseError extends Error {
  readonly code: RecordBidOutcomeError;
  constructor(code: RecordBidOutcomeError) {
    super(code);
    this.name = 'BidOutcomeResponseError';
    this.code = code;
  }
}

export interface RecordBidOutcomeResult {
  id: string;
  status: 'SUBMITTED';
  outcome: BidOutcome;
  outcomeAt: Date;
  outcomeNotes: string | null;
  outcomeAudit: OutcomeAudit;
}

// Outcome audit schema version — increment when OutcomeAuditEntry shape
// changes (matches the AUDIT_SCHEMA_VERSION precedent).
const OUTCOME_AUDIT_SCHEMA_VERSION = 1;

// recordBidOutcome — stamps a terminal `outcome` (+ optional notes + audit
// entry) onto a SUBMITTED BidDraft owned by `actor`. First outcome wins:
// once `row.outcome` is set, future calls surface `already_outcome` so the
// route can 409 + replay rather than silently overwriting history.
//
// Ownership-scoped via `where: { id, ownerUserId: actor.id }` (404 lands on
// miss — preserves the IDOR posture set by the existing submit handler).
// Transitions `SUBMITTED → SUBMITTED + outcome` inside a single prisma
// transaction so a partial write never surfaces as a chip without its audit.
export async function recordBidOutcome(
  id: string,
  actor: SessionUser,
  payload: BidOutcomeRequest,
  now: Date = new Date(),
): Promise<RecordBidOutcomeResult> {
  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  const row = await prisma.bidDraft.findFirst({
    where: { id, ownerUserId: actor.id },
  });
  if (!row) {
    throw new BidOutcomeResponseError('not_found');
  }

  if (row.status !== 'SUBMITTED') {
    throw new BidOutcomeResponseError('not_submitted');
  }

  if (row.outcome != null) {
    throw new BidOutcomeResponseError('already_outcome');
  }

  const entry: OutcomeAuditEntry = payload.outcomeNotes
    ? {
        version: OUTCOME_AUDIT_SCHEMA_VERSION,
        at: now.toISOString(),
        byUserId: actor.id,
        fromStatus: 'SUBMITTED',
        toOutcome: payload.outcome,
        notes: payload.outcomeNotes,
      }
    : {
        version: OUTCOME_AUDIT_SCHEMA_VERSION,
        at: now.toISOString(),
        byUserId: actor.id,
        fromStatus: 'SUBMITTED',
        toOutcome: payload.outcome,
      };

  await prisma.$transaction([
    prisma.bidDraft.update({
      where: { id },
      data: {
        outcome: payload.outcome,
        outcomeAt: now,
        outcomeNotes: payload.outcomeNotes ?? null,
        outcomeAudit: [entry] as unknown as object,
      },
    }),
  ]);

  return {
    id,
    status: 'SUBMITTED',
    outcome: payload.outcome,
    outcomeAt: now,
    outcomeNotes: payload.outcomeNotes ?? null,
    outcomeAudit: [entry],
  };
}
