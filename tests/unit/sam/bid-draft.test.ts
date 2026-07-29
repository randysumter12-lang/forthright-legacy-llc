// @polsia:user-owned — unit tests for the Bid Draft generator.
// The composition path is pure (no `server-only`/`@/lib/db`), so the tests
// compose against canonical fixtures with no DB mocking. The orchestrator
// path is exercised through vi.doMock for @/lib/db so we can assert the
// prisma.upsert contract without round-tripping Postgres.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BidDraftCapabilityInput,
  type BidDraftOpportunityInput,
  composeBidDraft,
  generateBidDraft,
  HumanApprovalRequiredError,
  renderBidDraftMarkdown,
  transitionBidDraftStatus,
} from '../../../src/lib/business/bid-draft';
import {
  BID_DRAFT_STATUS,
  BidDraft,
  BidDraftResult,
  BidDraftSections,
} from '../../../src/lib/contracts/bid-draft';

const IT_SERVICES_OPP: BidDraftOpportunityInput = {
  id: 'opp-it-1',
  noticeId: '36C10X-24-Q-0047',
  title: 'Network infrastructure upgrade',
  agency: 'Department of Veterans Affairs',
  naicsCode: '541512',
  category: 'IT_SERVICES',
  setAside: 'SDVOSBC',
  dueDate: new Date('2026-08-01T17:00:00Z'),
  postedDate: new Date('2026-07-15T17:00:00Z'),
  awardValue: 9500,
  description: 'Upgrade routing/switching stack for VA regional office.',
  uiLink: 'https://sam.gov/opp/36C10X-24-Q-0047',
};

const CMMC_OPP: BidDraftOpportunityInput = {
  ...IT_SERVICES_OPP,
  id: 'opp-cmmc-1',
  noticeId: 'CMMC-001',
  title: 'CMMC gap assessment for DIB subcontractor',
  agency: 'DoD',
  naicsCode: '541690',
  category: 'CMMC',
  setAside: 'SBA',
  awardValue: null,
};

const OTHER_OPP: BidDraftOpportunityInput = {
  ...IT_SERVICES_OPP,
  id: 'opp-other-1',
  noticeId: 'OTHER-001',
  title: 'Misc micro-purchase',
  agency: 'USDA',
  naicsCode: '999999',
  category: 'OTHER',
  setAside: null,
  awardValue: null,
};

const CONSULTING_OPP: BidDraftOpportunityInput = {
  ...IT_SERVICES_OPP,
  id: 'opp-consulting-1',
  noticeId: 'CONSULT-001',
  title: 'Operational process study for federal program office',
  agency: 'GSA',
  naicsCode: '541611',
  category: 'CONSULTING',
  setAside: null,
  awardValue: null,
};

const CAPABILITY_INPUT: BidDraftCapabilityInput = {
  companyName: 'Rigel Solutions',
  tagline: 'AI-powered federal micro-purchase delivery.',
  contactName: 'Rigel Solutions — Contracts Office',
  contactEmail: 'rigel-solutions@polsia.io',
  contactPhone: 'Provided on award package',
  contactWebsite: 'https://rigelcontracts.co',
  competencies: [
    {
      name: 'Cloud platform lift-and-shift',
      description: 'Migrate legacy workloads to AWS, Azure, or GCP with low-downtime cutover.',
    },
    {
      name: 'Network architecture & modernization',
      description: 'Design and harden LAN/WAN/SASE topologies for distributed teams.',
    },
  ],
  pastPerformance: [
    {
      client: 'U.S. Department of the Navy (internal)',
      scope: 'Operational and systems work within Active Duty Navy role.',
      value: null,
      period: 'Active Duty — current',
    },
  ],
};

const FROZEN_NOW = new Date('2026-07-20T13:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.doUnmock('@/lib/db');
});

describe('composeBidDraft — never-blank', () => {
  it('covers every required section across the IT_SERVICES / CMMC / CONSULTING / OTHER fixtures', () => {
    for (const opp of [IT_SERVICES_OPP, CMMC_OPP, CONSULTING_OPP, OTHER_OPP]) {
      const composed = composeBidDraft(opp, CAPABILITY_INPUT, { now: FROZEN_NOW });
      const s = composed.sections;
      expect(s.cover.noticeId).toBe(opp.noticeId);
      expect(s.cover.companyName).toBe(CAPABILITY_INPUT.companyName);
      expect(s.cover.tagline).toBe(CAPABILITY_INPUT.tagline);
      expect(s.technicalApproach.narrative.length).toBeGreaterThan(0);
      expect(s.technicalApproach.competencies.length).toBeGreaterThan(0);
      expect(s.technicalApproach.founderFraming.length).toBeGreaterThan(0);
      expect(s.staffing.founder.branch).toContain('Navy');
      expect(s.staffing.qualifications.length).toBeGreaterThan(0);
      expect(s.pricingSummary.band.length).toBeGreaterThan(0);
      expect(s.pricingSummary.lineItems.length).toBeGreaterThan(0);
      expect(s.pricingSummary.narrative.length).toBeGreaterThan(0);
      expect(s.pastPerformance.items.length).toBeGreaterThan(0);
      expect(s.complianceMatrix.rows.length).toBeGreaterThan(0);
    }
  });

  it('renders pricing section even when awardValue is null (micro-purchase band)', () => {
    const composed = composeBidDraft(OTHER_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    expect(composed.sections.pricingSummary.awardValue).toBeNull();
    expect(composed.sections.pricingSummary.band).toMatch(/\$3,500/);
    expect(composed.sections.pricingSummary.narrative).toContain('$3,500');
    expect(composed.sections.pricingSummary.narrative).toContain('$10,000');
  });

  it('embeds the typed BidDraftSections contract — zod parse succeeds', () => {
    for (const opp of [IT_SERVICES_OPP, CMMC_OPP, CONSULTING_OPP, OTHER_OPP]) {
      const composed = composeBidDraft(opp, CAPABILITY_INPUT, { now: FROZEN_NOW });
      expect(() => BidDraftSections.parse(composed.sections)).not.toThrow();
      expect(() =>
        BidDraftResult.parse({
          samOpportunityId: opp.id,
          draft: {
            id: 'd1',
            samOpportunityId: opp.id,
            status: 'DRAFT',
            revision: 0,
            generatedAt: FROZEN_NOW.toISOString(),
            updatedAt: FROZEN_NOW.toISOString(),
            sections: composed.sections,
            markdown: composed.markdown,
          },
        }),
      ).not.toThrow();
    }
  });
});

describe('renderBidDraftMarkdown — deterministic + printable', () => {
  it('renders all six section headings (1. Cover … 6. Compliance Matrix)', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    expect(composed.markdown).toContain('## 1. Cover Page');
    expect(composed.markdown).toContain('## 2. Technical Approach');
    expect(composed.markdown).toContain('## 3. Staffing & Qualifications');
    expect(composed.markdown).toContain('## 4. Pricing Summary');
    expect(composed.markdown).toContain('## 5. Past Performance');
    expect(composed.markdown).toMatch(/## 6. Compliance Matrix/);
  });

  it('produces identical output for identical inputs (deterministic)', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    const ctx = {
      noticeId: IT_SERVICES_OPP.noticeId,
      agency: IT_SERVICES_OPP.agency,
      status: 'DRAFT' as const,
      revision: 0,
      generatedAt: FROZEN_NOW,
    };
    expect(renderBidDraftMarkdown(composed.sections, ctx)).toBe(composed.markdown);
    expect(renderBidDraftMarkdown(composed.sections, ctx)).toBe(
      renderBidDraftMarkdown(composed.sections, ctx),
    );
  });

  it('uses the company contact email verbatim (rigel-solutions@polsia.io)', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    expect(composed.markdown).toContain('rigel-solutions@polsia.io');
  });

  it('keeps status flag = DRAFT in the print body (the human-approval gate)', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    expect(composed.markdown).toMatch(/Status:\s+DRAFT/);
  });

  it('covers the compliance matrix rows in print form', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    expect(composed.markdown).toContain('SAM.gov Registration');
    expect(composed.markdown).toContain('Compliance Matrix');
    expect(composed.markdown).toContain('541512');
  });
});

describe('composeBidDraft — orchestrator parity', () => {
  it('composer markdown re-rendered against the same args is identical', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    const reRendered = renderBidDraftMarkdown(composed.sections, {
      noticeId: IT_SERVICES_OPP.noticeId,
      agency: IT_SERVICES_OPP.agency,
      status: 'DRAFT',
      revision: 0,
      generatedAt: FROZEN_NOW,
    });
    expect(reRendered).toBe(composed.markdown);
  });
});

describe('composeBidDraft — cover badges', () => {
  // Anchor the markdown badge assertion on the Cover Page section (Section 3
  // also prints the founder's "Active Duty U.S. Navy" branch — slice on
  // "## 2. Technical Approach" so the cover-section-only substring matches).
  function coverMarkdown(composed: { markdown: string }): string {
    const coverEnd = composed.markdown.indexOf('## 2. Technical Approach');
    return coverEnd === -1 ? composed.markdown : composed.markdown.slice(0, coverEnd);
  }

  for (const opp of [IT_SERVICES_OPP, CMMC_OPP, CONSULTING_OPP, OTHER_OPP]) {
    it(`emits both policy badges on cover for ${opp.category} (${opp.id})`, () => {
      const composed = composeBidDraft(opp, CAPABILITY_INPUT, { now: FROZEN_NOW });
      expect(composed.sections.cover.badges).toContain('Active Duty U.S. Navy');
      expect(composed.sections.cover.badges).toContain('Minority-Owned');
      // Stable order: Navy first, then Minority-Owned.
      expect(composed.sections.cover.badges[0]).toBe('Active Duty U.S. Navy');
      expect(composed.sections.cover.badges[1]).toBe('Minority-Owned');
      const cover = coverMarkdown(composed);
      expect(cover).toContain('## 1. Cover Page');
      expect(cover).toContain('Active Duty U.S. Navy');
      expect(cover).toContain('Minority-Owned');
    });
  }

  it('cover-badge markdown section is deterministic across re-renders', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    const reRendered = renderBidDraftMarkdown(composed.sections, {
      noticeId: IT_SERVICES_OPP.noticeId,
      agency: IT_SERVICES_OPP.agency,
      status: 'DRAFT',
      revision: 0,
      generatedAt: FROZEN_NOW,
    });
    expect(reRendered).toBe(composed.markdown);
    expect(coverMarkdown({ markdown: reRendered })).toContain('Active Duty U.S. Navy');
    expect(coverMarkdown({ markdown: reRendered })).toContain('Minority-Owned');
  });
});

describe('generateBidDraft orchestrator — upsert contract', () => {
  it('upserts a BidDraft row tied to the SamOpportunity id with status="DRAFT"', async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: 'draft-1',
      samOpportunityId: IT_SERVICES_OPP.id,
      status: 'DRAFT',
      revision: 0,
      generatedAt: FROZEN_NOW,
      updatedAt: FROZEN_NOW,
      markdown: 'cached-marker',
    });
    const capRow = {
      id: 'cap-1',
      samOpportunityId: IT_SERVICES_OPP.id,
      cover: {
        companyName: CAPABILITY_INPUT.companyName,
        tagline: CAPABILITY_INPUT.tagline,
        badges: ['Active Duty U.S. Navy', 'Minority-Owned'],
        generatedFor: {
          noticeId: IT_SERVICES_OPP.noticeId,
          title: IT_SERVICES_OPP.title,
          agency: IT_SERVICES_OPP.agency,
          category: IT_SERVICES_OPP.category,
          naicsCode: IT_SERVICES_OPP.naicsCode,
        },
      },
      contact: {
        name: CAPABILITY_INPUT.contactName,
        email: CAPABILITY_INPUT.contactEmail,
        phone: CAPABILITY_INPUT.contactPhone,
        website: CAPABILITY_INPUT.contactWebsite,
      },
      coreCompetencies: { items: CAPABILITY_INPUT.competencies },
      pastPerformance: { items: CAPABILITY_INPUT.pastPerformance },
    };
    const findUnique = vi.fn().mockResolvedValue({
      id: IT_SERVICES_OPP.id,
      noticeId: IT_SERVICES_OPP.noticeId,
      title: IT_SERVICES_OPP.title,
      agency: IT_SERVICES_OPP.agency,
      naicsCode: IT_SERVICES_OPP.naicsCode,
      category: IT_SERVICES_OPP.category,
      setAside: IT_SERVICES_OPP.setAside,
      dueDate: IT_SERVICES_OPP.dueDate,
      postedDate: IT_SERVICES_OPP.postedDate,
      awardValue: IT_SERVICES_OPP.awardValue,
      description: IT_SERVICES_OPP.description,
      uiLink: IT_SERVICES_OPP.uiLink,
      capabilityStatement: capRow,
    });
    vi.doMock('@/lib/db', () => ({
      prisma: { samOpportunity: { findUnique }, bidDraft: { upsert } },
    }));

    const result = await generateBidDraft(IT_SERVICES_OPP.id, { now: FROZEN_NOW });

    expect(result).not.toBeNull();
    expect(result?.samOpportunityId).toBe(IT_SERVICES_OPP.id);
    expect(result?.draft.status).toBe('DRAFT');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: IT_SERVICES_OPP.id },
      include: { capabilityStatement: true },
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = upsert.mock.calls[0]?.[0] as {
      where: { samOpportunityId: string };
      create: { samOpportunityId: string; status: string };
      update: { status: string; revision: unknown };
    };
    expect(upsertArgs.where.samOpportunityId).toBe(IT_SERVICES_OPP.id);
    expect(upsertArgs.create.samOpportunityId).toBe(IT_SERVICES_OPP.id);
    expect(upsertArgs.create.status).toBe('DRAFT');
    expect(upsertArgs.update.status).toBe('DRAFT');
    // never silently 'SUBMITTED'
    expect(upsertArgs.create.status).not.toBe('SUBMITTED');
    expect(upsertArgs.update.status).not.toBe('SUBMITTED');
  });

  it('returns null when the SamOpportunity id has no row', async () => {
    const upsert = vi.fn();
    const findUnique = vi.fn().mockResolvedValue(null);
    vi.doMock('@/lib/db', () => ({
      prisma: { samOpportunity: { findUnique }, bidDraft: { upsert } },
    }));

    const result = await generateBidDraft('missing-id', { now: FROZEN_NOW });
    expect(result).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('throws capability_statement_required when no capability row exists', async () => {
    const upsert = vi.fn();
    const findUnique = vi.fn().mockResolvedValue({
      id: IT_SERVICES_OPP.id,
      noticeId: IT_SERVICES_OPP.noticeId,
      title: IT_SERVICES_OPP.title,
      agency: IT_SERVICES_OPP.agency,
      naicsCode: IT_SERVICES_OPP.naicsCode,
      category: IT_SERVICES_OPP.category,
      setAside: IT_SERVICES_OPP.setAside,
      dueDate: IT_SERVICES_OPP.dueDate,
      postedDate: IT_SERVICES_OPP.postedDate,
      awardValue: IT_SERVICES_OPP.awardValue,
      description: IT_SERVICES_OPP.description,
      uiLink: IT_SERVICES_OPP.uiLink,
      capabilityStatement: null,
    });
    vi.doMock('@/lib/db', () => ({
      prisma: { samOpportunity: { findUnique }, bidDraft: { upsert } },
    }));

    await expect(generateBidDraft(IT_SERVICES_OPP.id, { now: FROZEN_NOW })).rejects.toThrow(
      /capability_statement_required/,
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('end-to-end ≤5s SLA', () => {
  it('orchestrator (with mocked prisma) runs below the 5s acceptance budget', async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: 'draft-2',
      samOpportunityId: IT_SERVICES_OPP.id,
      status: 'DRAFT',
      revision: 0,
      generatedAt: FROZEN_NOW,
      updatedAt: FROZEN_NOW,
      markdown: 'memo',
    });
    const capRow = {
      id: 'cap-2',
      samOpportunityId: IT_SERVICES_OPP.id,
      cover: {
        companyName: CAPABILITY_INPUT.companyName,
        tagline: CAPABILITY_INPUT.tagline,
        badges: ['Active Duty U.S. Navy', 'Minority-Owned'],
        generatedFor: {
          noticeId: IT_SERVICES_OPP.noticeId,
          title: IT_SERVICES_OPP.title,
          agency: IT_SERVICES_OPP.agency,
          category: IT_SERVICES_OPP.category,
          naicsCode: IT_SERVICES_OPP.naicsCode,
        },
      },
      contact: {
        name: CAPABILITY_INPUT.contactName,
        email: CAPABILITY_INPUT.contactEmail,
        phone: CAPABILITY_INPUT.contactPhone,
        website: CAPABILITY_INPUT.contactWebsite,
      },
      coreCompetencies: { items: CAPABILITY_INPUT.competencies },
      pastPerformance: { items: CAPABILITY_INPUT.pastPerformance },
    };
    const findUnique = vi.fn().mockResolvedValue({
      id: IT_SERVICES_OPP.id,
      noticeId: IT_SERVICES_OPP.noticeId,
      title: IT_SERVICES_OPP.title,
      agency: IT_SERVICES_OPP.agency,
      naicsCode: IT_SERVICES_OPP.naicsCode,
      category: IT_SERVICES_OPP.category,
      setAside: IT_SERVICES_OPP.setAside,
      dueDate: IT_SERVICES_OPP.dueDate,
      postedDate: IT_SERVICES_OPP.postedDate,
      awardValue: IT_SERVICES_OPP.awardValue,
      description: IT_SERVICES_OPP.description,
      uiLink: IT_SERVICES_OPP.uiLink,
      capabilityStatement: capRow,
    });
    vi.doMock('@/lib/db', () => ({
      prisma: { samOpportunity: { findUnique }, bidDraft: { upsert } },
    }));

    const start = performance.now();
    const result = await generateBidDraft(IT_SERVICES_OPP.id, { now: FROZEN_NOW });
    const elapsed = performance.now() - start;
    expect(result).not.toBeNull();
    const parsed = BidDraftResult.parse(result as BidDraftResult);
    expect(parsed.draft.id).toBe('draft-2');
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('transitionBidDraftStatus — status gate', () => {
  it('rejects DRAFT → SUBMITTED with HumanApprovalRequiredError', async () => {
    const update = vi.fn();
    const findUnique = vi.fn().mockResolvedValue({
      id: 'draft-1',
      status: 'DRAFT',
    });
    vi.doMock('@/lib/db', () => ({
      prisma: { bidDraft: { findUnique, update } },
    }));

    await expect(transitionBidDraftStatus('draft-1', 'SUBMITTED')).rejects.toBeInstanceOf(
      HumanApprovalRequiredError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('allows DRAFT → REVIEW', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'draft-1', status: 'REVIEW' });
    const findUnique = vi.fn().mockResolvedValue({ id: 'draft-1', status: 'DRAFT' });
    vi.doMock('@/lib/db', () => ({
      prisma: { bidDraft: { findUnique, update } },
    }));

    const result = await transitionBidDraftStatus('draft-1', 'REVIEW');
    expect(result.status).toBe('REVIEW');
    expect(update).toHaveBeenCalledWith({ where: { id: 'draft-1' }, data: { status: 'REVIEW' } });
  });

  it('allows REVIEW → SUBMITTED (a human has reviewed)', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'draft-1', status: 'SUBMITTED' });
    const findUnique = vi.fn().mockResolvedValue({ id: 'draft-1', status: 'REVIEW' });
    vi.doMock('@/lib/db', () => ({
      prisma: { bidDraft: { findUnique, update } },
    }));

    const result = await transitionBidDraftStatus('draft-1', 'SUBMITTED');
    expect(result.status).toBe('SUBMITTED');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
      data: { status: 'SUBMITTED' },
    });
  });

  it('rejects unknown target statuses', async () => {
    const findUnique = vi.fn();
    vi.doMock('@/lib/db', () => ({
      prisma: { bidDraft: { findUnique } },
    }));

    await expect(
      transitionBidDraftStatus('draft-1', 'BOGUS' as unknown as (typeof BID_DRAFT_STATUS)[number]),
    ).rejects.toThrow(/invalid_status/);
  });

  it('BID_DRAFT_STATUS enumerates DRAFT, REVIEW, SUBMITTED', () => {
    expect([...BID_DRAFT_STATUS]).toEqual(['DRAFT', 'REVIEW', 'SUBMITTED']);
  });
});

describe('BidDraft envelope — full contract round-trip', () => {
  it('composes a typed BidDraftResult parseable as BidDraft', () => {
    const composed = composeBidDraft(IT_SERVICES_OPP, CAPABILITY_INPUT, { now: FROZEN_NOW });
    const parsed = BidDraft.parse({
      id: 'draft-x',
      samOpportunityId: IT_SERVICES_OPP.id,
      status: 'DRAFT',
      revision: 0,
      generatedAt: FROZEN_NOW.toISOString(),
      updatedAt: FROZEN_NOW.toISOString(),
      sections: composed.sections,
      markdown: composed.markdown,
    });
    expect(parsed.id).toBe('draft-x');
    expect(parsed.status).toBe('DRAFT');
  });
});
