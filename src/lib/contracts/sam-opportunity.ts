// @polsia:user-owned — shared zod contract for the SAM.gov opportunities feed.
// Client-importable: zod only, no server-only imports. Mirrors the Prisma
// SamOpportunity shape minus server-internal fields (rawJson, internal id).
import { z } from 'zod';
import { BID_DRAFT_STATUS, OUTCOME } from '@/lib/contracts/bid-draft';
import { SetAsideQualification } from '@/lib/contracts/set-aside';

export const SAM_CATEGORY = ['IT_SERVICES', 'CMMC', 'CONSULTING', 'OTHER'] as const;
export type SamCategory = (typeof SAM_CATEGORY)[number];

export const SOURCE_DISCRIMINATOR = ['SAM', 'UNISON'] as const;
export type SourceDiscriminator = (typeof SOURCE_DISCRIMINATOR)[number];

// Public read shape — exact subset of fields the /sam page renders.
// `source` defaults to 'SAM' so legacy payloads (and the existing green-rail
// test fixture, which has no `source` key) keep parsing; Unison-only columns
// are optional + nullable so SAM entries round-trip without them.
// `draftStatus` is the LEFT-JOINed BidDraft.status; optional so opportunities
// that haven't been auto-drafted yet still parse.
export const SamOpportunityItem = z.object({
  id: z.string().min(1), // internal cuid; used for /sam/<id> detail routing
  noticeId: z.string().min(1),
  title: z.string(),
  agency: z.string(),
  naicsCode: z.string(),
  dueDate: z.string().nullable().optional(),
  postedDate: z.string().nullable().optional(),
  awardValue: z.number().nullable().optional(),
  setAside: z.string().nullable().optional(),
  isSetAside: z.boolean(),
  category: z.enum(SAM_CATEGORY),
  description: z.string().nullable().optional(),
  uiLink: z.string().nullable().optional(),
  scrapedAt: z.string(),
  source: z.enum(SOURCE_DISCRIMINATOR).default('SAM').optional(),
  unisonBuyId: z.string().nullable().optional(),
  unisonRevision: z.number().int().nullable().optional(),
  buyerType: z.string().nullable().optional(),
  leadLagState: z.string().nullable().optional(),
  activeTargetPrice: z.number().nullable().optional(),
  bidDecrement: z.number().nullable().optional(),
  lineItems: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  solicitationNumber: z.string().nullable().optional(),
  draftStatus: z.enum(BID_DRAFT_STATUS).optional(),
});
export type SamOpportunityItem = z.infer<typeof SamOpportunityItem>;

// Strict discriminated union — gate for ingestion-side parsing. The flat
// SamOpportunityItem above stays permissive (optional source, optional
// Unison scalars) for backwards compatibility with the existing read path;
// this union enforces per-source required-field shape for new payloads.
const SamBaseFields = z.object({
  id: z.string().min(1),
  noticeId: z.string().min(1),
  title: z.string(),
  agency: z.string(),
  naicsCode: z.string(),
  dueDate: z.string().nullable().optional(),
  postedDate: z.string().nullable().optional(),
  awardValue: z.number().nullable().optional(),
  setAside: z.string().nullable().optional(),
  isSetAside: z.boolean(),
  category: z.enum(SAM_CATEGORY),
  description: z.string().nullable().optional(),
  uiLink: z.string().nullable().optional(),
  scrapedAt: z.string(),
  activeTargetPrice: z.number().nullable().optional(),
  bidDecrement: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  solicitationNumber: z.string().nullable().optional(),
});

export const SamOpportunityItemSam = SamBaseFields.extend({
  source: z.literal('SAM'),
});
export type SamOpportunityItemSam = z.infer<typeof SamOpportunityItemSam>;

export const SamOpportunityItemUnison = SamBaseFields.extend({
  source: z.literal('UNISON'),
  unisonBuyId: z.string().min(1),
  unisonRevision: z.number().int().min(1),
  buyerType: z.string().min(1),
  leadLagState: z.string().min(1),
  activeTargetPrice: z.number().nullable().optional(),
  bidDecrement: z.number().nullable().optional(),
  lineItems: z.array(z.record(z.string(), z.unknown())).min(1),
});
export type SamOpportunityItemUnison = z.infer<typeof SamOpportunityItemUnison>;

export const SamOpportunityItemUnion = z.discriminatedUnion('source', [
  SamOpportunityItemSam,
  SamOpportunityItemUnison,
]);
export type SamOpportunityItemUnion = z.infer<typeof SamOpportunityItemUnion>;

export const SamOpportunityList = z.object({
  items: z.array(SamOpportunityItem),
  nextCursor: z.string().nullable().optional(),
  lastRun: z
    .object({
      status: z.enum(['RUNNING', 'OK', 'ERROR', 'RATE_LIMITED', 'UNKNOWN']),
      startedAt: z.string().nullable().optional(),
      finishedAt: z.string().nullable().optional(),
      fetchedCount: z.number().optional(),
      upsertedCount: z.number().optional(),
      errorMessage: z.string().nullable().optional(),
      trigger: z.string().nullable().optional(),
      source: z.string().optional(),
    })
    .optional(),
});
export type SamOpportunityList = z.infer<typeof SamOpportunityList>;

// Structured diagnostic returned by /api/sam-opportunities when the underlying
// Prisma call throws. Client islands parse `err.cause` through this schema
// (apiFetch sets the parsed JSON body as the Error's `cause`) so the user
// sees the actual Prisma code/message instead of a misleading generic hint.
// `kind` groups Prisma's many error codes into the OPERATOR's decision
// branches: schema reconciliation vs. pooler connectivity vs. anything else.
export const SAM_LIST_ERROR_KIND = ['schema_mismatch', 'connectivity', 'other'] as const;
export type SamListErrorKind = (typeof SAM_LIST_ERROR_KIND)[number];

export const SamListError = z.object({
  error: z.literal('sam_list_failed'),
  diagnostic: z.object({
    code: z.string(),
    message: z.string(),
    kind: z.enum(SAM_LIST_ERROR_KIND),
  }),
});
export type SamListError = z.infer<typeof SamListError>;

// POST /refresh result envelope.
export const SamOpportunityTriggerResult = z.object({
  run: z.object({
    id: z.string(),
    status: z.enum(['RUNNING', 'OK', 'ERROR', 'RATE_LIMITED']),
    startedAt: z.string(),
    finishedAt: z.string().nullable().optional(),
    fetchedCount: z.number(),
    upsertedCount: z.number(),
    errorMessage: z.string().nullable().optional(),
    trigger: z.string(),
    source: z.string().optional(),
  }),
});
export type SamOpportunityTriggerResult = z.infer<typeof SamOpportunityTriggerResult>;

// Query params for GET /api/sam-opportunities.
export const SamOpportunityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(SAM_CATEGORY).optional(),
  setAside: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  source: z.enum(SOURCE_DISCRIMINATOR).optional(),
});
export type SamOpportunityQuery = z.infer<typeof SamOpportunityQuery>;

// GET /api/sam-opportunities/<id> — single-record detail read shape.
// `bidDraftId` + `draftStatus` are LEFT-JOINed BidDraft fields. When a
// BidDraft exists for this opportunity, the `/sam/<id>` page renders an
// inline approve-pending chip and embeds the <BidDraftApproveButton> for
// `DRAFT → REVIEW`. The two fields are both optional so opportunities
// without a BidDraft (fresh scrape, not-yet-qualified, etc.) still parse.
// `bidDraftRevision` is the persisted `revision` counter on the BidDraft row;
// the submit button uses it as the `responseVersion` payload value when the
// opportunity is in REVIEW.
//
// Outcome fields (`outcome / outcomeAt / outcomeNotes`) come from the same
// LEFT-JOINed BidDraft — populated when POST /api/bids/<id>/outcome records
// a terminal state on the row, otherwise null. The header chip adjacent to
// <SourceBadge> + the <BidOutcomeButtons> island both read from this single
// source so the buttons hide the moment the chip appears, no extra fetch.
// `outcomeAudit` is intentionally NOT shipped on this envelope; it's only
// round-tripped on the BidDraft read (see contracts/bid-draft.ts).
export const SamOpportunityDetail = z.object({
  item: SamOpportunityItem,
  hasCapabilityStatement: z.boolean(),
  qualifications: z.array(SetAsideQualification).optional(),
  bidDraftId: z.string().nullable().optional(),
  bidDraftRevision: z.number().int().min(0).nullable().optional(),
  bidDraftSubmittedAt: z.string().min(1).nullable().optional(),
  draftStatus: z.enum(BID_DRAFT_STATUS).optional(),
  outcome: z.enum(OUTCOME).nullable().optional(),
  outcomeAt: z.string().min(1).nullable().optional(),
  outcomeNotes: z.string().min(1).nullable().optional(),
});
export type SamOpportunityDetail = z.infer<typeof SamOpportunityDetail>;
