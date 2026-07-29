// @polsia:user-owned — shared zod contract for generated Capability Statements.
// Client-importable: zod only, no server-only imports. Mirrors the JSON shape
// the GET /sam and POST /api/sam-opportunities/<id>/capability-statement
// seam returns from the typed `fullDocument` payload.
import { z } from 'zod';

export const CAPABILITY_CATEGORY_LABEL = ['IT_SERVICES', 'CMMC', 'CONSULTING', 'OTHER'] as const;
export type CapabilityCategoryLabel = (typeof CAPABILITY_CATEGORY_LABEL)[number];

export const CapabilityCover = z.object({
  companyName: z.string().min(1),
  tagline: z.string().min(1),
  badges: z.array(z.string()).min(1),
  generatedFor: z.object({
    noticeId: z.string().min(1),
    title: z.string().min(1),
    agency: z.string().min(1),
    category: z.enum(CAPABILITY_CATEGORY_LABEL),
    naicsCode: z.string().min(1),
  }),
});
export type CapabilityCover = z.infer<typeof CapabilityCover>;

export const CapabilityCompanyOverview = z.object({
  narrative: z.string().min(1),
  founded: z.string().min(1),
  headquarters: z.string().min(1),
});
export type CapabilityCompanyOverview = z.infer<typeof CapabilityCompanyOverview>;

export const CapabilityCompetencyItem = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});
export type CapabilityCompetencyItem = z.infer<typeof CapabilityCompetencyItem>;

export const CapabilityCoreCompetencies = z.object({
  items: z.array(CapabilityCompetencyItem).min(1),
});
export type CapabilityCoreCompetencies = z.infer<typeof CapabilityCoreCompetencies>;

export const CapabilityDifferentiators = z.object({
  items: z.array(z.string().min(1)).min(1),
});
export type CapabilityDifferentiators = z.infer<typeof CapabilityDifferentiators>;

export const CapabilityPastPerformanceEntry = z.object({
  client: z.string().min(1),
  scope: z.string().min(1),
  value: z.number().nullable(),
  period: z.string().min(1),
});
export type CapabilityPastPerformanceEntry = z.infer<typeof CapabilityPastPerformanceEntry>;

export const CapabilityPastPerformance = z.object({
  items: z.array(CapabilityPastPerformanceEntry).min(1),
});
export type CapabilityPastPerformance = z.infer<typeof CapabilityPastPerformance>;

export const CapabilityCertifications = z.object({
  naics: z.array(z.string().min(1)).min(1),
  certifications: z.array(z.string().min(1)),
  setAside: z.array(z.string().min(1)),
});
export type CapabilityCertifications = z.infer<typeof CapabilityCertifications>;

export const CapabilityContact = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
  website: z.string().url(),
});
export type CapabilityContact = z.infer<typeof CapabilityContact>;

export const CapabilityStatement = z.object({
  cover: CapabilityCover,
  companyOverview: CapabilityCompanyOverview,
  coreCompetencies: CapabilityCoreCompetencies,
  differentiators: CapabilityDifferentiators,
  pastPerformance: CapabilityPastPerformance,
  certifications: CapabilityCertifications,
  contact: CapabilityContact,
  policyBadges: z.array(z.string()).min(1),
  generatedAt: z.string().min(1),
});
export type CapabilityStatement = z.infer<typeof CapabilityStatement>;

export const CapabilityStatementResult = z.object({
  samOpportunityId: z.string().min(1),
  statement: CapabilityStatement,
});
export type CapabilityStatementResult = z.infer<typeof CapabilityStatementResult>;
