// @polsia:user-owned — unit tests for the founder notification helper. The
// helper does server-only fetch to the platform email proxy with bearer
// auth and is documented to swallow proxy faults into console.error; these
// tests pin the success contract, the missing-env skip, and the two
// failure shapes (non-2xx response + network error) and assert the bearer
// token never appears in any console.error payload.

let currentEnv: {
  POLSIA_API_BASE_URL: string;
  POLSIA_OWNER_EMAIL: string | undefined;
  POLSIA_API_KEY: string | undefined;
};

vi.mock('server-only', () => ({}));

vi.mock('@/lib/env', () => ({
  get env() {
    return currentEnv;
  },
}));

const IMPORT_PATH = '@/lib/business/notifications/notify-founder-on-bid-submission';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baseArgs = {
  bidDraftId: 'c11234567890abcdefghij',
  ownerUserId: 'owner_user_123',
  actorId: 'owner_user_123',
  source: 'SAM' as const,
  noticeId: '36C10X-24-Q-0047',
  title: 'Network infrastructure upgrade',
  agency: 'Department of Veterans Affairs',
  naicsCode: '541512',
  setAside: 'SDVOSBC' as string | null,
  isSetAside: true,
  dueDate: '2026-08-01T17:00:00.000Z',
  submittedAt: new Date('2026-07-25T18:30:00.000Z'),
};

function makeJsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('notifyFounderOnBidSubmission', () => {
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

  it('posts to the email proxy with bearer auth and renders subject/body+html on success', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));

    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission(baseArgs);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url.toString()).toBe('https://polsia.com/api/proxy/email/send');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer company_test_key_aaaaaaaaaaaaa');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.cache).toBe('no-store');
    const body = JSON.parse(String(init.body)) as {
      to: string;
      subject: string;
      body: string;
      html: string;
    };
    expect(body.to).toBe('founder@example.com');
    expect(body.subject).toContain('Bid submitted:');
    expect(body.subject).toContain('Network infrastructure upgrade');
    expect(body.subject).toContain('SAM.gov');
    expect(body.body).toContain('Network infrastructure upgrade');
    expect(body.body).toContain('541512');
    expect(body.body).toContain('SAM.gov');
    expect(body.body).toContain('SDVOSBC');
    expect(body.body).toContain('c11234567890abcdefghij');
    expect(body.html).toContain('<table');
    expect(body.html).toContain('SAM.gov');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders the Unison Global badge for UNISON source', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission({ ...baseArgs, source: 'UNISON' });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const body = JSON.parse(String(init.body)) as {
      subject: string;
      body: string;
      html: string;
    };
    expect(body.subject).toContain('Unison Global');
    expect(body.subject).not.toContain('SAM.gov');
    expect(body.body).toContain('Unison Global');
    expect(body.body).not.toContain('SAM.gov');
    expect(body.html).toContain('Unison Global');
    expect(body.html).not.toContain('SAM.gov');
  });

  it('uses the bid draft id as the subject title when the title is missing', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission({ ...baseArgs, title: '' });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const body = JSON.parse(String(init.body)) as { subject: string };
    expect(body.subject).toContain('c11234567890abcdefghij');
    expect(body.subject.startsWith('Bid submitted: c11234567890abcdefghij')).toBe(true);
  });

  it('strips newlines from the title and clamps it to <=120 chars', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    const tooLong = `Line1\nLine2 ${'x'.repeat(150)}`;
    await notifyFounderOnBidSubmission({ ...baseArgs, title: tooLong });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const body = JSON.parse(String(init.body)) as { subject: string };
    expect(body.subject).not.toContain('\n');
    expect(body.subject.length).toBeLessThanOrEqual(
      `Bid submitted: ${'x'.repeat(120)} (SAM.gov)`.length,
    );
    expect(body.subject).toContain('...');
  });

  it('renders "None" in the set-aside chip when isSetAside is false', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission({
      ...baseArgs,
      source: 'UNISON',
      isSetAside: false,
      setAside: 'SDVOSBC',
    });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const body = JSON.parse(String(init.body)) as { body: string; html: string };
    expect(body.body).toContain('Set-aside: None');
    expect(body.body).not.toContain('Set-aside: SDVOSBC');
    expect(body.html).toContain('>None<');
    expect(body.html).not.toContain('>SDVOSBC<');
  });

  it('does not call fetch when POLSIA_OWNER_EMAIL is unset and logs the missing key', async () => {
    currentEnv = { ...currentEnv, POLSIA_OWNER_EMAIL: undefined };
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission(baseArgs);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      msg: string;
      keys: string;
    };
    expect(payload.msg).toMatch(/missing env/);
    expect(payload.keys).toBe('POLSIA_OWNER_EMAIL');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls[0]);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
  });

  it('does not call fetch when POLSIA_API_KEY is unset and logs the missing key', async () => {
    currentEnv = { ...currentEnv, POLSIA_API_KEY: undefined };
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission(baseArgs);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      msg: string;
      keys: string;
    };
    expect(payload.msg).toMatch(/missing env/);
    expect(payload.keys).toBe('POLSIA_API_KEY');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls[0]);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
  });

  it('absorbs a non-2xx proxy response: logs status + parsed error and returns successfully', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{"error":"rate_limited"}', 429));
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await expect(notifyFounderOnBidSubmission(baseArgs)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      tagline: string;
      status: number;
      error: string | null;
    };
    expect(payload.tagline).toBe('notify-founder-on-bid-submission');
    expect(payload.status).toBe(429);
    expect(payload.error).toBe('rate_limited');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls[0]);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
    expect(serialized).not.toContain('Bearer');
  });

  it('absorbs a network rejection and returns successfully without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await expect(notifyFounderOnBidSubmission(baseArgs)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      tagline: string;
      status: number | null;
      error: string;
    };
    expect(payload.tagline).toBe('notify-founder-on-bid-submission');
    expect(payload.status).toBeNull();
    expect(payload.error).toBe('connection refused');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls[0]);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
  });
});

describe('notifyFounderOnBidSubmission env keys', () => {
  it('never logs the resolved POLSIA_API_KEY value in any error path', async () => {
    currentEnv = {
      POLSIA_API_BASE_URL: 'https://polsia.com',
      POLSIA_OWNER_EMAIL: undefined,
      POLSIA_API_KEY: 'company_secret_value_xyz',
    };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { notifyFounderOnBidSubmission } = await import(IMPORT_PATH);
    await notifyFounderOnBidSubmission(baseArgs);

    expect(fetchSpy).not.toHaveBeenCalled();
    const allSerialized = JSON.stringify(errSpy.mock.calls);
    expect(allSerialized).not.toContain('company_secret_value_xyz');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
