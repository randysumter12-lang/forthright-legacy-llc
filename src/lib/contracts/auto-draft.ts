// @polsia:user-owned — shared zod contract for the auto-draft orchestrator.
// Client-importable: zod only, no server-only imports. Mirrors the
// AutoDraftRun audit row.
import { z } from 'zod';

export const AUTO_DRAFT_SKIP_REASONS = [
  'qualify_fail',
  'unison_band_semantics_pending',
  'no_capability_statement',
  'no_opportunity',
  'already_fresh',
] as const;
export type AutoDraftSkipReason = (typeof AUTO_DRAFT_SKIP_REASONS)[number];

export const AUTO_DRAFT_RUN_STATUS = ['RUNNING', 'OK', 'ERROR', 'SKIPPED'] as const;
export type AutoDraftRunStatus = (typeof AUTO_DRAFT_RUN_STATUS)[number];

// AutoDraftRun affordances — exposed by POST /api/auto-draft/refresh, dashboard
// "Today's Bid Queue" header, and jobs/auto-draft.ts console logging.
export const AutoDraftRun = z.object({
  id: z.string().min(1),
  status: z.enum(AUTO_DRAFT_RUN_STATUS),
  startedAt: z.string().min(1),
  finishedAt: z.string().nullable().optional(),
  trigger: z.string().min(1),
  considered: z.number().int().min(0),
  qualified: z.number().int().min(0),
  drafted: z.number().int().min(0),
  skipped: z.number().int().min(0),
  reasonCounts: z.record(z.string(), z.number()).optional(),
  errorMessage: z.string().nullable().optional(),
});
export type AutoDraftRun = z.infer<typeof AutoDraftRun>;

// POST /refresh trigger envelope — mirrors SamOpportunityTriggerResult posture.
export const AutoDraftTriggerResult = z.object({
  run: AutoDraftRun,
});
export type AutoDraftTriggerResult = z.infer<typeof AutoDraftTriggerResult>;

// LAST-RUN envelope shape used by GET /api/bid-drafts — denormalized so the
// dashboard "Today's Bid Queue" header shows counts without a second round-trip.
// Lives here (not sam-opportunity.ts) to avoid a circular import with bid-draft.ts.
export const LastAutoDraftRun = z.object({
  id: z.string(),
  status: z.enum(AUTO_DRAFT_RUN_STATUS),
  startedAt: z.string(),
  finishedAt: z.string().nullable().optional(),
  trigger: z.string(),
  considered: z.number().int(),
  qualified: z.number().int(),
  drafted: z.number().int(),
  skipped: z.number().int(),
  reasonCounts: z.record(z.string(), z.number()).optional(),
  errorMessage: z.string().nullable().optional(),
});
export type LastAutoDraftRun = z.infer<typeof LastAutoDraftRun>;
