// @polsia:user-owned — Capability Statement generator. The pure composition
// helpers and COMPANY_PROFILE constant live alongside the orchestrator that
// upserts the typed JSON envelope. The orchestrator uses a LAZY dynamic
// import of @/lib/db so unit tests can compose against pure exports without
// pulling `@/lib/db`'s `server-only` marker into a jsdom environment.
import type { PrismaClient } from '@prisma/client';
import {
  CapabilityStatement,
  type CapabilityStatementResult,
} from '@/lib/contracts/capability-statement';
import type { SamCategory } from '@/lib/contracts/sam-opportunity';

const COMPANY_NAME = 'Rigel Solutions';
const COMPANY_TAGLINE = 'AI-powered federal micro-purchase delivery.';
const COMPANY_FOUNDED = '2026';
const COMPANY_HQ = 'Remote · Washington DC metro area';

export interface SamOpportunityInput {
  id: string;
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  category: SamCategory;
  setAside: string | null;
  dueDate: Date | null;
  description: string | null;
  uiLink: string | null;
}

export interface PastPerformanceEntry {
  client: string;
  scope: string;
  value: number | null;
  period: string;
}

export interface CompanyProfile {
  name: string;
  tagline: string;
  founded: string;
  headquarters: string;
  founder: {
    name: string;
    branch: string;
    status: string;
    ownership: string;
  };
  naics: readonly string[];
  certifications: readonly string[];
  setAsides: readonly string[];
  pastPerformance: readonly PastPerformanceEntry[];
  contact: {
    name: string;
    email: string;
    phone: string;
    website: string;
  };
}

// CORE_COMPETENCIES — rendered per-category. The brief scopes Capability
// Statements to IT services, CMMC pre-reviews, and operational consulting, so
// the OTHER bucket carries a deliberately narrow generic fallback.
const CORE_COMPETENCIES: Record<SamCategory, { name: string; description: string }[]> = {
  IT_SERVICES: [
    {
      name: 'Cloud platform lift-and-shift',
      description:
        'Migrate legacy workloads to AWS, Azure, or GCP with low-downtime cutover: networking, IAM, observability, and cost guardrails.',
    },
    {
      name: 'Network architecture & modernization',
      description:
        'Design and harden LAN/WAN/SASE topologies, segment routing + switching stacks, and VPN replacement for distributed teams.',
    },
    {
      name: 'DevSecOps pipeline build-out',
      description:
        'Stand up CI/CD with policy-as-code, SBOM, container scanning, and signed releases — auditable end-to-end.',
    },
    {
      name: 'Endpoint & identity administration',
      description:
        'Modern endpoint management, conditional access, MFA enforcement, and zero-trust network access for federal stakeholders.',
    },
  ],
  CMMC: [
    {
      name: 'CMMC Level 1–3 gap assessment',
      description:
        'Map current NIST 800-171 / 800-172 controls to the target CMMC level, produce a scored gap register with prioritized remediation.',
    },
    {
      name: 'Cybersecurity maturity pre-review',
      description:
        'Independent pre-assessment against the CMMC model — interview-driven evidence walk + assessor-ready artifact package.',
    },
    {
      name: 'SSP & POA&M authoring',
      description:
        'System Security Plan authorship, with a POA&M that maps each gap to an owner, ETA, and verification step.',
    },
    {
      name: 'CUI handling & boundary scoping',
      description:
        'Define CUI assets and boundary, build handling procedures, and align training plans to DFARS 7012 / 7020 obligations.',
    },
  ],
  CONSULTING: [
    {
      name: 'Operational process improvement',
      description:
        'Lean / Six Sigma rooted studies of acquisition, finance, and HR workflows with a sequenced 90-day delivery plan.',
    },
    {
      name: 'Strategic program review',
      description:
        'Independent program health diagnostics: schedule, cost, risk, and stakeholder alignment, with executive-ready briefs.',
    },
    {
      name: 'Acquisition & sourcing advisory',
      description:
        'Market scan + small-business set-aside strategy for federal program offices; position on best-value sourcing decisions.',
    },
  ],
  OTHER: [
    {
      name: 'Rapid-turnaround research',
      description:
        'Short-horizon research and writing briefs tailored to a federal micro-purchase SOW — desk-research, interviews, and concise deliverables.',
    },
  ],
};

const DIFFERENTIATORS: readonly string[] = [
  'Verified Minority-Owned small business designation — preferential positioning for applicable set-aside buys.',
  'Founder on Active Duty U.S. Navy orders, bringing direct insight into DoD mission, acquisition tempo, and compliance posture.',
  'AI-native drafting pipeline — every Capability Statement and bid response is generated, reviewer-approved, and tracked.',
  'Daily SAM.gov surveillance: surfaced opportunities reach the bid queue within 24 hours of posting, not weeks.',
  'Low-overhead delivery model tuned for the $3,500–$10,000 simplified acquisition band.',
];

const PAST_PERFORMANCE: readonly PastPerformanceEntry[] = [
  {
    client: 'U.S. Department of the Navy (internal)',
    scope:
      "Operational and systems work within the founder's Active Duty role — direct exposure to acquisition, contracting, and IT service delivery inside the federal mission space.",
    value: null,
    period: 'Active Duty — current',
  },
];

export const COMPANY_PROFILE: CompanyProfile = {
  name: COMPANY_NAME,
  tagline: COMPANY_TAGLINE,
  founded: COMPANY_FOUNDED,
  headquarters: COMPANY_HQ,
  founder: {
    name: 'Founder-Operator',
    branch: 'U.S. Navy',
    status: 'Active Duty',
    ownership: 'Minority-Owned',
  },
  naics: ['541512', '541511', '541519', '541690', '541618', '541330'],
  certifications: ['Minority-Owned Small Business (self-certified SBA)', 'SAM.gov registered'],
  setAsides: ['Minority-Owned'],
  pastPerformance: PAST_PERFORMANCE,
  contact: {
    name: 'Rigel Solutions — Contracts Office',
    email: 'rigel-solutions@polsia.io',
    phone: 'Provided on award package',
    website: 'https://rigelcontracts.co',
  },
};

const CATEGORY_LABEL: Record<SamCategory, string> = {
  IT_SERVICES: 'IT Services',
  CMMC: 'CMMC Pre-Review',
  CONSULTING: 'Operational Consulting',
  OTHER: 'Federal Micro-Purchase',
};

export function derivePolicyBadges(_profile: CompanyProfile): readonly [string, string] {
  // Brand-locked badges — the founder's confirmed status. Order is
  // deterministic so cover badges render in a stable sequence regardless of
  // the input opportunity.
  return ['Active Duty U.S. Navy', 'Minority-Owned'];
}

export function categoryLabel(category: SamCategory): string {
  return CATEGORY_LABEL[category];
}

export function formatSetAsideBadge(setAside: string | null): string | null {
  if (!setAside) return null;
  const trimmed = setAside.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export interface ComposeOptions {
  generatedAt?: Date;
}

export function composeCapabilityStatement(
  opp: SamOpportunityInput,
  profile: CompanyProfile,
  options: ComposeOptions = {},
): CapabilityStatement {
  const generatedAt = options.generatedAt ?? new Date();
  const policyBadges = derivePolicyBadges(profile);
  const navyBadge = policyBadges[0];
  const minorityBadge = policyBadges[1];

  const coverBadges: string[] = [navyBadge, minorityBadge, CATEGORY_LABEL[opp.category]];
  const setAsideBadge = formatSetAsideBadge(opp.setAside);
  if (setAsideBadge) coverBadges.push(setAsideBadge);

  const overview = `${profile.name} delivers AI-assisted federal micro-purchase bids at the $3,500–$10,000 simplified acquisition band. Founded and operated from the ${profile.headquarters} by a verified Minority-Owned, Active Duty U.S. Navy founder, we pair daily SAM.gov surveillance with reviewer-trusted drafting to compress time-to-award.`;

  const competencies = CORE_COMPETENCIES[opp.category];

  return {
    cover: {
      companyName: profile.name,
      tagline: profile.tagline,
      badges: coverBadges,
      generatedFor: {
        noticeId: opp.noticeId,
        title: opp.title,
        agency: opp.agency,
        category: opp.category,
        naicsCode: opp.naicsCode,
      },
    },
    companyOverview: {
      narrative: overview,
      founded: profile.founded,
      headquarters: profile.headquarters,
    },
    coreCompetencies: { items: competencies },
    differentiators: { items: [...DIFFERENTIATORS] },
    pastPerformance: { items: [...profile.pastPerformance] },
    certifications: {
      naics: [...profile.naics],
      certifications: [...profile.certifications],
      setAside: [...profile.setAsides],
    },
    contact: {
      name: profile.contact.name,
      email: profile.contact.email,
      phone: profile.contact.phone,
      website: profile.contact.website,
    },
    policyBadges: [navyBadge, minorityBadge],
    generatedAt: generatedAt.toISOString(),
  };
}

export interface GenerateOptions {
  now?: Date;
}

// Orchestrator with LAZY @/lib/db import — keeps the file jsdom-loadable
// without mocking while the server route handler works the full Prisma path.
export async function generateCapabilityStatement(
  samOpportunityId: string,
  options: GenerateOptions = {},
): Promise<CapabilityStatementResult | null> {
  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };
  const opp = await prisma.samOpportunity.findUnique({
    where: { id: samOpportunityId },
  });
  if (!opp) return null;

  const input: SamOpportunityInput = {
    id: opp.id,
    noticeId: opp.noticeId,
    title: opp.title,
    agency: opp.agency,
    naicsCode: opp.naicsCode,
    category: opp.category as SamCategory,
    setAside: opp.setAside,
    dueDate: opp.dueDate,
    description: opp.description,
    uiLink: opp.uiLink,
  };

  const now = options.now ?? new Date();
  const composed = composeCapabilityStatement(input, COMPANY_PROFILE, { generatedAt: now });
  const parsed = CapabilityStatement.parse(composed);

  await prisma.capabilityStatement.upsert({
    where: { samOpportunityId },
    create: {
      samOpportunityId: opp.id,
      cover: parsed.cover as unknown as object,
      companyOverview: parsed.companyOverview as unknown as object,
      coreCompetencies: parsed.coreCompetencies as unknown as object,
      differentiators: parsed.differentiators as unknown as object,
      pastPerformance: parsed.pastPerformance as unknown as object,
      certifications: parsed.certifications as unknown as object,
      contact: parsed.contact as unknown as object,
      fullDocument: parsed as unknown as object,
    },
    update: {
      cover: parsed.cover as unknown as object,
      companyOverview: parsed.companyOverview as unknown as object,
      coreCompetencies: parsed.coreCompetencies as unknown as object,
      differentiators: parsed.differentiators as unknown as object,
      pastPerformance: parsed.pastPerformance as unknown as object,
      certifications: parsed.certifications as unknown as object,
      contact: parsed.contact as unknown as object,
      fullDocument: parsed as unknown as object,
    },
  });

  return { samOpportunityId: opp.id, statement: parsed };
}
