// @polsia:user-owned — shared zod contract for generated Bid Drafts.
// Client-importable: zod only, no server-only imports. Mirrors the JSON
// shape the POST /api/sam-opportunities/<id>/bid-draft and GET /api/bid-drafts/<id>
// seam returns, plus the printable Markdown payload the renderer reads.
//
// Note: this file does NOT import from @/lib/contracts/sam-opportunity to
// avoid a circular import. The `BidDraftListItem.opportunity` shape is a
// hand-typed mirror of the subset we surface in the queue; keep it in sync
// with `SamOpportunityItem` by hand if the shape changes.
import { z } from 'zod';

// Mirror of SamOpportunityItem's `source` discriminator — keep in sync.
const SOURCE = ['SAM', 'UNISON'] as const;

// Mirror of SamOpportunityItem's category — keep in sync.
const SAM_CATEGORY = ['IT_SERVICES', 'CMMC', 'CONSULTING', 'OTHER'] as const;

export const BID_DRAFT_STATUS = ['DRAFT', 'REVIEW', 'SUBMITTED'] as const;
export type BidDraftStatus = (typeof BID_DRAFT_STATUS)[number];

// Outcome enum + runtime list — parallel to Prisma's `BidOutcome` enum. Used
// by /api/bids/<id>/outcome, the BidOutcomeRequest zod schema, and the
// outcome chip + buttons on /sam/<id> + /submitted-bids.
export const OUTCOME = ['WON', 'LOST', 'NO_RESPONSE'] as const;
export type BidOutcome = (typeof OUTCOME)[number];

// MARK: — section payloads ---------------------------------------------------

export const BidCover = z.object({
  noticeId: z.string().min(1),
  title: z.string().min(1),
  agency: z.string().min(1),
  naicsCode: z.string().min(1),
  category: z.string().min(1),
  setAside: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  postedDate: z.string().nullable().optional(),
  awardValue: z.number().nullable().optional(),
  companyName: z.string().min(1),
  tagline: z.string().min(1),
  badges: z.array(z.string().min(1)).min(1).readonly(),
  contact: z.object({
    name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().min(1),
    website: z.string().min(1),
  }),
});
export type BidCover = z.infer<typeof BidCover>;

export const BidTechnicalApproach = z.object({
  category: z.string().min(1),
  narrative: z.string().min(1),
  competencies: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),
  founderFraming: z.string().min(1),
});
export type BidTechnicalApproach = z.infer<typeof BidTechnicalApproach>;

export const BidStaffing = z.object({
  founder: z.object({
    name: z.string().min(1),
    branch: z.string().min(1),
    status: z.string().min(1),
    ownership: z.string().min(1),
  }),
  founded: z.string().min(1),
  headquarters: z.string().min(1),
  qualifications: z.array(z.string().min(1)).min(1),
});
export type BidStaffing = z.infer<typeof BidStaffing>;

export const BidPricingSummary = z.object({
  band: z.string().min(1),
  structure: z.string().min(1),
  lineItems: z
    .array(
      z.object({
        laborCategory: z.string().min(1),
        rate: z.number(),
        unit: z.string().min(1),
      }),
    )
    .min(1),
  narrative: z.string().min(1),
  awardValue: z.number().nullable().optional(),
});
export type BidPricingSummary = z.infer<typeof BidPricingSummary>;

export const BidPastPerformanceItem = z.object({
  client: z.string().min(1),
  scope: z.string().min(1),
  value: z.number().nullable(),
  period: z.string().min(1),
});
export type BidPastPerformanceItem = z.infer<typeof BidPastPerformanceItem>;

export const BidPastPerformance = z.object({
  items: z.array(BidPastPerformanceItem).min(1),
});
export type BidPastPerformance = z.infer<typeof BidPastPerformance>;

export const BidComplianceRow = z.object({
  clause: z.string().min(1),
  posture: z.enum(['COMPLIANT', 'ASSERTED', 'PENDING']),
  evidence: z.string().min(1),
});
export type BidComplianceRow = z.infer<typeof BidComplianceRow>;

export const BidComplianceMatrix = z.object({
  threshold: z.string().min(1),
  rows: z.array(BidComplianceRow).min(1),
});
export type BidComplianceMatrix = z.infer<typeof BidComplianceMatrix>;

// MARK: — submission audit + /api/bids/<id>/submit -----------------------

// Single audit record — what the persisted JSONB `submission_audit` array
// stores. `version` is the audit-schema version (currently 1); `responseVersion`
// is the BidDraft.revision the human submitted against (so a developer's later
// edits don't accidentally tuck a stale note into a fresh submission).
export const BidAuditEntry = z.object({
  version: z.number().int().min(1),
  source: z.enum(SOURCE),
  actor: z.string().min(1),
  recordedAt: z.string().min(1),
  responseVersion: z.number().int().min(0),
});
export type BidAuditEntry = z.infer<typeof BidAuditEntry>;

export const BidAudit = z.array(BidAuditEntry).min(1);
export type BidAudit = z.infer<typeof BidAudit>;

// Request shape for POST /api/bids/<id>/submit. `confirm: true` is the explicit
// human gate — the absence of which is a 400 `invalid_payload` (mirrors the
// `PostBidSubmitRequest.confirm` lint rule elsewhere).
export const BidSubmitRequest = z.object({
  responseVersion: z.number().int().min(0),
  source: z.enum(SOURCE),
  confirm: z.literal(true),
});
export type BidSubmitRequest = z.infer<typeof BidSubmitRequest>;

// Confirmation object the success envelope returns. `submissionAudit` is the
// freshly-appended single-entry array — the row is flushed inside one tx so
// this shape is always consistent with the persisted column.
export const BidSubmitResult = z.object({
  id: z.string().min(1),
  status: z.enum(BID_DRAFT_STATUS),
  submittedAt: z.string().min(1),
  submittedByUserId: z.string().min(1),
  submissionAudit: BidAudit,
});
export type BidSubmitResult = z.infer<typeof BidSubmitResult>;

// 409 idempotent-replay envelope: when a caller POSTs again after a successful
// submit, the route returns the EXISTING audit summary so the client can
// render the row without an extra GET round-trip.
export const BidDraftSubmissionEnvelope = z.object({
  alreadySubmitted: z.literal(true),
  submittedAt: z.string().min(1),
  submittedByUserId: z.string().min(1),
  submissionAudit: BidAudit,
});
export type BidDraftSubmissionEnvelope = z.infer<typeof BidDraftSubmissionEnvelope>;

// MARK: — outcome audit + /api/bids/<id>/outcome ----------------------------
//
// Single audit record — what the persisted JSONB `outcome_audit` array
// stores. `version` is the audit-schema version (currently 1); `toOutcome`
// is the final terminal state; `fromStatus` records the prior draft status
// (always 'SUBMITTED' on first outcome). `notes` is the caller-supplied
// free-text when present, otherwise omitted. Mirrors the submission-audit
// cluster above.
export const OutcomeAuditEntry = z.object({
  version: z.literal(1),
  at: z.string().min(1),
  byUserId: z.string().min(1),
  fromStatus: z.enum(['SUBMITTED']),
  toOutcome: z.enum(OUTCOME),
  notes: z.string().min(1).optional(),
});
export type OutcomeAuditEntry = z.infer<typeof OutcomeAuditEntry>;

export const OutcomeAudit = z.array(OutcomeAuditEntry).min(1);
export type OutcomeAudit = z.infer<typeof OutcomeAudit>;

const OUTCOME_NOTES_MAX = 2000;

// Request shape for POST /api/bids/<id>/outcome. `outcome` is one of the
// OUTCOME literals; `outcomeNotes` is optional free-text trimmed to the
// OUTCOME_NOTES_MAX ceiling so a malformed payload doesn't smuggle
// megabytes into the JSONB audit column.
export const BidOutcomeRequest = z.object({
  outcome: z.enum(OUTCOME),
  outcomeNotes: z
    .string()
    .trim()
    .max(OUTCOME_NOTES_MAX)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});
export type BidOutcomeRequest = z.infer<typeof BidOutcomeRequest>;

// Success envelope returned on a 200 POST. Mirrors BidSubmitResult — same
// audit-rountrip shape, fields converted to ISO8601 strings for the wire.
export const BidOutcomeResult = z.object({
  id: z.string().min(1),
  status: z.enum(BID_DRAFT_STATUS),
  outcome: z.enum(OUTCOME),
  outcomeAt: z.string().min(1),
  outcomeNotes: z.string().min(1).nullable().optional(),
  outcomeAudit: OutcomeAudit,
});
export type BidOutcomeResult = z.infer<typeof BidOutcomeResult>;

// 409 re-record envelope — when a caller POSTs an outcome onto an already-
// outcome-bearing row, the route returns the EXISTING outcome + audit so
// the client can render the row without an extra GET round-trip. Mirrors
// the BidDraftSubmissionEnvelope idempotency pattern.
export const BidOutcomeReplayEnvelope = z.object({
  alreadyOutcome: z.literal(true),
  outcome: z.enum(OUTCOME),
  outcomeAt: z.string().min(1),
  outcomeNotes: z.string().min(1).nullable().optional(),
  outcomeAudit: OutcomeAudit,
});
export type BidOutcomeReplayEnvelope = z.infer<typeof BidOutcomeReplayEnvelope>;

// MARK: — envelope -----------------------------------------------------------

export const BidDraftSections = z.object({
  cover: BidCover,
  technicalApproach: BidTechnicalApproach,
  staffing: BidStaffing,
  pricingSummary: BidPricingSummary,
  pastPerformance: BidPastPerformance,
  complianceMatrix: BidComplianceMatrix,
});
export type BidDraftSections = z.infer<typeof BidDraftSections>;

export const BidDraft = z.object({
  id: z.string().min(1),
  samOpportunityId: z.string().min(1),
  status: z.enum(BID_DRAFT_STATUS),
  revision: z.number().int().min(0),
  generatedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  sections: BidDraftSections,
  markdown: z.string().min(1),
  // Submission audit fields — populated by POST /api/bids/<id>/submit. All
  // optional so legacy (never-submitted) drafts round-trip through the
  // GET envelope without breaking parse. `submissionAudit` is an ordered
  // list of audit entries (latest entry appended last); earlier versions
  // of the audit schema may have fewer fields than the current record.
  submittedAt: z.string().min(1).nullable().optional(),
  submittedByUserId: z.string().min(1).nullable().optional(),
  submissionAudit: z.array(BidAuditEntry).optional(),
  // Outcome fields — populated by POST /api/bids/<id>/outcome on SUBMITTED
  // rows. All four optional so legacy/draft rows round-trip cleanly. The
  // outcome chip on <SamDetail> + <SubmittedBidsTable> only renders when
  // `outcome` is non-null.
  outcome: z.enum(OUTCOME).nullable().optional(),
  outcomeAt: z.string().min(1).nullable().optional(),
  outcomeNotes: z.string().min(1).nullable().optional(),
  outcomeAudit: z.array(OutcomeAuditEntry).optional(),
});
export type BidDraft = z.infer<typeof BidDraft>;

export const BidDraftResult = z.object({
  samOpportunityId: z.string().min(1),
  source: z.enum(SOURCE).default('SAM').optional(),
  draft: BidDraft,
});
export type BidDraftResult = z.infer<typeof BidDraftResult>;

// MARK: — list endpoint ------------------------------------------------------

// Lightweight list item for the dashboard "Today's Bid Queue" — keeps the
// envelope round-trip small and decoupled from the full BidDraft sections.
// We hand-mirror the SamOpportunityItem fields we surface here to avoid
// importing from sam-opportunity.ts (that would reintroduce the cycle).
export const BidDraftListItem = z.object({
  id: z.string().min(1),
  samOpportunityId: z.string().min(1),
  status: z.enum(BID_DRAFT_STATUS),
  revision: z.number().int().min(0),
  generatedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  opportunity: z.object({
    id: z.string().min(1),
    noticeId: z.string().min(1),
    title: z.string(),
    agency: z.string(),
    dueDate: z.string().nullable().optional(),
    postedDate: z.string().nullable().optional(),
    awardValue: z.number().nullable().optional(),
    setAside: z.string().nullable().optional(),
    isSetAside: z.boolean(),
    category: z.enum(SAM_CATEGORY),
    source: z.enum(SOURCE).default('SAM').optional(),
    activeTargetPrice: z.number().nullable().optional(),
  }),
});
export type BidDraftListItem = z.infer<typeof BidDraftListItem>;

export const BidDraftList = z.object({
  items: z.array(BidDraftListItem),
  lastAutoDraftRun: z
    .object({
      id: z.string(),
      status: z.enum(['RUNNING', 'OK', 'ERROR', 'SKIPPED']),
      startedAt: z.string(),
      finishedAt: z.string().nullable().optional(),
      trigger: z.string(),
      considered: z.number().int(),
      qualified: z.number().int(),
      drafted: z.number().int(),
      skipped: z.number().int(),
      reasonCounts: z.record(z.string(), z.number()).optional(),
      errorMessage: z.string().nullable().optional(),
    })
    .optional(),
});
export type BidDraftList = z.infer<typeof BidDraftList>;

export const BidDraftListQuery = z.object({
  status: z.string().optional(), // CSV over BID_DRAFT_STATUS; enforced server-side
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type BidDraftListQuery = z.infer<typeof BidDraftListQuery>;

// MARK: — status transition --------------------------------------------------

export const BidDraftStatusTransitionRequest = z.object({
  target: z.enum(BID_DRAFT_STATUS),
});
export type BidDraftStatusTransitionRequest = z.infer<typeof BidDraftStatusTransitionRequest>;

export const BidDraftStatusTransitionResult = z.object({
  id: z.string().min(1),
  status: z.enum(BID_DRAFT_STATUS),
});
export type BidDraftStatusTransitionResult = z.infer<typeof BidDraftStatusTransitionResult>;
