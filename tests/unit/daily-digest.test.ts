// @polsia:user-owned — unit tests for the morning digest helper. Pins:
//   - sort ordering: confidence desc → urgency asc → title asc, top-5 cap
//   - HTML escaping of free-text fields (title contains a <script>)
//   - siteUrl absolutization (link uses param, not string concat)
//   - SKIPPED result when POLSIA_OWNER_EMAIL is missing (no fetch issued)
//   - missing admin row → still emits email with openBidDrafts = 0
//   - empty qualifying list → "no new qualifying" totals-only digest
//   - bearer token never appears in any logged value

let currentEnv: {
  POLSIA_API_BASE_URL: string;
  POLSIA_OWNER_EMAIL: string | undefined;
  POLSIA_API_KEY: string | undefined;
};

let dbState: {
  samOpportunities: Array<{
    id: string;
    noticeId: string;
    title: string;
    agency: string;
    naicsCode: string;
    setAside: string | null;
    dueDate: Date | null;
    source: 'SAM' | 'UNISON';
  }>;
  openBidDraftCount: number;
};

vi.mock('server-only', () => ({}));

vi.mock('@/lib/env', () => ({
  get env() {
    return currentEnv;
  },
}));

vi.mock('@/lib/db', () => ({
  get prisma() {
    return {
      samOpportunity: {
        findMany: async () => dbState.samOpportunities,
      },
      bidDraft: {
        count: async () => dbState.openBidDraftCount,
      },
      $disconnect: async () => {},
    };
  },
}));

const IMPORT_PATH = '@/lib/business/daily-digest';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-07-25T14:00:00.000Z');

function opp(overrides: {
  noticeId: string;
  title?: string;
  agency?: string;
  naicsCode?: string;
  setAside?: string | null;
  source?: 'SAM' | 'UNISON';
  dueOffsetHours?: number | null;
}): {
  id: string;
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  setAside: string | null;
  dueDate: Date | null;
  source: 'SAM' | 'UNISON';
} {
  const dueOffset = overrides.dueOffsetHours ?? null;
  return {
    id: `id-${overrides.noticeId}`,
    noticeId: overrides.noticeId,
    title: overrides.title ?? `Title ${overrides.noticeId}`,
    agency: overrides.agency ?? 'Department of the Navy',
    naicsCode: overrides.naicsCode ?? '541512',
    setAside: overrides.setAside ?? null,
    dueDate: dueOffset === null ? null : new Date(NOW.getTime() + dueOffset * 60 * 60 * 1000),
    source: overrides.source ?? 'SAM',
  };
}

function makeJsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('runMorningDigest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    currentEnv = {
      POLSIA_API_BASE_URL: 'https://polsia.com',
      POLSIA_OWNER_EMAIL: 'founder@example.com',
      POLSIA_API_KEY: 'company_test_key_aaaaaaaaaaaaa',
    };
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('picks top 5 by confidence desc → urgency asc → title asc and renders totals', async () => {
    dbState = {
      samOpportunities: [
        opp({ noticeId: 'A', title: 'A title', dueOffsetHours: 24 * 6 }), // SOON
        opp({ noticeId: 'B', title: 'B title', dueOffsetHours: 24 * 1 }), // THIS_WEEK
        opp({ noticeId: 'C', title: 'C title', dueOffsetHours: 12 }), // IMMINENT
        opp({ noticeId: 'D', title: 'D title', dueOffsetHours: -24 }), // OVERDUE
        opp({ noticeId: 'E', title: 'E title', dueOffsetHours: 24 * 30 }), // OK
        opp({ noticeId: 'F', title: 'F title', dueOffsetHours: null }), // UNKNOWN
        opp({ noticeId: 'G', title: 'G title', naicsCode: '999999' }), // not qualifying
      ],
      openBidDraftCount: 4,
    };
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));

    const { runMorningDigest } = await import(IMPORT_PATH);
    const result = await runMorningDigest({
      recipient: 'founder@example.com',
      ownerUserId: 'founder_user_id',
      now: NOW,
      siteUrl: 'http://localhost:3000',
    });

    expect(result.status).toBe('OK');
    expect(result.subject).toMatch(/Sam morning digest — 2026-07-25/);
    expect(result.subject).not.toMatch(/no new qualifying/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const payload = JSON.parse(String(init.body)) as {
      to: string;
      subject: string;
      body: string;
      html: string;
    };

    // F (UNKNOWN) and G (not qualifying) are dropped; only D, C, B, A, E render
    // in that order (urgency asc).
    expect(payload.body).toContain('[1] SAM.gov — D title');
    expect(payload.body).toContain('[2] SAM.gov — C title');
    expect(payload.body).toContain('[3] SAM.gov — B title');
    expect(payload.body).toContain('[4] SAM.gov — A title');
    expect(payload.body).toContain('[5] SAM.gov — E title');
    expect(payload.body).not.toContain('F title');
    expect(payload.body).not.toContain('G title');
    expect(payload.body).toContain('+2 more qualifying rows');
    // Totals: 7 qualifying (all rows pass the SBA@0.6 bucket because the
    // profile carries SAM.gov registered), 3 deadlines-in-7d (A,B,C — D is
    // OVERDUE/E is beyond 7 days/F,G have no dueDate), 4 openBidDrafts.
    expect(payload.body).toContain('Qualifying this week: 7');
    expect(payload.body).toContain('Deadlines in next 7 days: 3');
    expect(payload.body).toContain('Open bid drafts: 4');
  });

  it('emits the EMPTY totals-only digest when no opportunities exist in the catalog', async () => {
    dbState = { samOpportunities: [], openBidDraftCount: 0 };
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));

    const { runMorningDigest } = await import(IMPORT_PATH);
    const result = await runMorningDigest({
      recipient: 'founder@example.com',
      ownerUserId: 'founder_user_id',
      now: NOW,
      siteUrl: 'http://localhost:3000',
    });

    expect(result.status).toBe('EMPTY');
    expect(result.subject).toMatch(/no new qualifying/);
    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const payload = JSON.parse(String(init.body)) as { body: string; html: string };
    expect(payload.body).toContain('No new qualifying opportunities overnight');
    expect(payload.body).not.toContain('[1]');
    expect(payload.html).toContain('No new qualifying opportunities overnight');
  });

  it('HTML-escapes the title, agency, NAICS, and link in the html body', async () => {
    dbState = {
      samOpportunities: [
        opp({
          noticeId: 'EVIL',
          title: '<script>alert(1)</script>',
          agency: 'A & B / "Quoted"',
          naicsCode: '541512',
          dueOffsetHours: 24 * 2,
        }),
      ],
      openBidDraftCount: 1,
    };
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));

    const { runMorningDigest } = await import(IMPORT_PATH);
    await runMorningDigest({
      recipient: 'founder@example.com',
      ownerUserId: 'founder_user_id',
      now: NOW,
      siteUrl: 'http://localhost:3000',
    });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const payload = JSON.parse(String(init.body)) as { body: string; html: string };

    expect(payload.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(payload.html).toContain('A &amp; B / &quot;Quoted&quot;');
    expect(payload.html).not.toMatch(/<script>/i);
    expect(payload.html).toContain('href="http://localhost:3000/sam/EVIL"');
    // the href must be the absolutized siteUrl + /sam/<noticeId>
    expect(payload.html).toContain('http://localhost:3000/sam/EVIL');
  });

  it('absolutizes the body link via siteUrl (not string concat)', async () => {
    dbState = {
      samOpportunities: [
        opp({ noticeId: 'SOLAR/123', title: 'Solar panel install', dueOffsetHours: 12 }),
      ],
      openBidDraftCount: 0,
    };
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));

    const { runMorningDigest } = await import(IMPORT_PATH);
    await runMorningDigest({
      recipient: 'founder@example.com',
      ownerUserId: 'founder_user_id',
      now: NOW,
      siteUrl: 'https://rigel.example.app',
    });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const payload = JSON.parse(String(init.body)) as { body: string; html: string };

    expect(payload.body).toContain('Link: https://rigel.example.app/sam/SOLAR%2F123');
    expect(payload.html).toContain('https://rigel.example.app/sam/SOLAR%2F123');
  });

  it('returns SKIPPED without fetching when the recipient is missing', async () => {
    currentEnv = { ...currentEnv, POLSIA_OWNER_EMAIL: undefined };
    dbState = { samOpportunities: [], openBidDraftCount: 0 };

    const { runMorningDigest } = await import(IMPORT_PATH);
    const result = await runMorningDigest({
      recipient: '', // empty recipient — helper skips send
      ownerUserId: 'founder_user_id',
      now: NOW,
      siteUrl: 'http://localhost:3000',
    });

    expect(result.status).toBe('SKIPPED');
    expect(result.errorMessage).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still sends the email when the admin row is missing (openBidDrafts renders 0)', async () => {
    dbState = {
      samOpportunities: [opp({ noticeId: 'ONLY', title: 'Only row', dueOffsetHours: 24 * 4 })],
      openBidDraftCount: 0,
    };
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));

    const { runMorningDigest } = await import(IMPORT_PATH);
    const result = await runMorningDigest({
      recipient: 'founder@example.com',
      ownerUserId: null, // missing admin user
      now: NOW,
      siteUrl: 'http://localhost:3000',
    });

    expect(result.status).toBe('OK');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const payload = JSON.parse(String(init.body)) as { body: string };
    expect(payload.body).toContain('Open bid drafts: 0');
  });

  it('never leaks the bearer token into logged values', async () => {
    dbState = { samOpportunities: [], openBidDraftCount: 0 };
    fetchMock.mockRejectedValue(new Error('boom'));

    const { runMorningDigest } = await import(IMPORT_PATH);
    const result = await runMorningDigest({
      recipient: 'founder@example.com',
      ownerUserId: 'founder_user_id',
      now: NOW,
      siteUrl: 'http://localhost:3000',
    });

    expect(result.status).toBe('SKIPPED');
    const errSerialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(errSerialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
    expect(errSerialized).not.toContain('Bearer');
  });
});
