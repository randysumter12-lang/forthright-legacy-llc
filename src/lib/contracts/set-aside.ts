// @polsia:user-owned — typed contract for the set-aside qualification engine.
// Client-importable: zod only, no server-only imports. Used by
// src/lib/business/set-aside.ts (pure ranker) and routed through
// src/lib/contracts/sam-opportunity.ts (detail envelope).
import { z } from 'zod';

export const SET_ASIDE_BUCKET = [
  '8A',
  'HUBZone',
  'SBA',
  'SDVOSB',
  'SmallBusiness',
  'WOSB',
] as const;
export type SetAsideBucket = (typeof SET_ASIDE_BUCKET)[number];

export const SetAsideQualification = z.object({
  bucket: z.enum(SET_ASIDE_BUCKET),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});
export type SetAsideQualification = z.infer<typeof SetAsideQualification>;

export const SetAsideOpportunity = z.object({
  noticeId: z.string().min(1),
  title: z.string(),
  agency: z.string(),
  naicsCode: z.string().min(1),
  setAside: z.string().nullable(),
  placeOfPerformance: z.string().nullable().optional(),
});
export type SetAsideOpportunity = z.infer<typeof SetAsideOpportunity>;
