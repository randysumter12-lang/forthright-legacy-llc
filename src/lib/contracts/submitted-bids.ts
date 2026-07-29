// @polsia:user-owned — shared zod contract for the /submitted-bids list page.
// Client-importable: zod only, no server-only imports.
//
// Mirrors the persistence-layer shape returned by GET /api/bids?status=submitted.
// `submittedAt` / `submittedByUserId` are always populated since the handler
// filters to `status = 'SUBMITTED'` rows where the submission transaction
// has already filled them in. `submissionAuditCount` is computed server-side
// from the JSONB length so the table can render a single integer without
// shipping the audit bodies over the wire.
//
// Outcome fields (`outcome` / `outcomeAt` / `outcomeNotes`) are also nullable
// here — a SUBMITTED row that hasn't been recorded yet keeps these as null;
// once POST /api/bids/<id>/outcome stamps the row, the same fields are
// round-tripped so the table can render the colored chip.
//
// Note: this file does NOT import from @/lib/contracts/sam-opportunity to
// avoid a circular import — the file already warns about that pattern. The
// `source` discriminator is hand-mirrored inline.
import { z } from 'zod';
import { BID_DRAFT_STATUS, OUTCOME } from '@/lib/contracts/bid-draft';

const SOURCE = ['SAM', 'UNISON'] as const;

export const SubmittedBidsItem = z.object({
  id: z.string().min(1),
  submittedAt: z.string().min(1),
  submittedByUserId: z.string().min(1),
  submissionAuditCount: z.number().int().min(0),
  source: z.enum(SOURCE),
  outcome: z.enum(OUTCOME).nullable().optional(),
  outcomeAt: z.string().min(1).nullable().optional(),
  outcomeNotes: z.string().min(1).nullable().optional(),
  opportunity: z.object({
    id: z.string().min(1),
    noticeId: z.string().min(1),
    title: z.string(),
    agency: z.string(),
    setAside: z.string().nullable().optional(),
    isSetAside: z.boolean(),
    dueDate: z.string().nullable().optional(),
  }),
});
export type SubmittedBidsItem = z.infer<typeof SubmittedBidsItem>;

export const SubmittedBids = z.object({
  items: z.array(SubmittedBidsItem),
});
export type SubmittedBids = z.infer<typeof SubmittedBids>;

export const SubmittedBidsQuery = z.object({
  status: z.enum(BID_DRAFT_STATUS).optional(),
});
export type SubmittedBidsQuery = z.infer<typeof SubmittedBidsQuery>;
