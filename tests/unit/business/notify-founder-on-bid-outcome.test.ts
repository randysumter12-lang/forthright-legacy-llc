// @polsia:user-owned — unit tests for the founder-on-WON-outcome helper.
// The helper does server-only fetch to the platform email proxy with bearer
// auth, resolves the recipient via prisma.user.findFirst({ role: 'admin' }),
// and is documented to swallow proxy faults into console.error. These
// tests pin the success contract, the missing-env skip, the missing-admin
// skip, and the two failure shapes (non-2xx response + network error) and
// assert the bearer token never appears in any console.error payload.

let currentEnv: {
  POLSIA_API_BASE_URL: string;
  POLSIA_API_KEY: string | undefined;
};

const prismaUserFindFirstMock = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/env', () => ({
  get env() {
    return currentEnv;
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: prismaUserFindFirstMock,
    },
  },
}));

const IMPORT_PATH = '@/lib/business/notifications/notify-founder-on-bid-outcome';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baseArgs = {
  bidDraftId: 'c11234567890abcdefghij',
  source: 'SAM' as const,
  title: 'Network infrastructure upgrade',
  agency: 'Department of Veterans Affairs',
  setAside: 'SDVOSBC' as string | null,
  isSetAside: true,
  outcomeAt: new Date('2026-07-26T10:00:00.000Z'),
};

function makeJsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('notifyFounderOnBidOutcome', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    currentEnv = {
      POLSIA_API_BASE_URL: 'https://polsia.com',
      POLSIA_API_KEY: 'company_test_key_aaaaaaaaaaaaa',
    };
    prismaUserFindFirstMock.mockReset();
    prismaUserFindFirstMock.mockResolvedValue({ email: 'founder@example.com' });
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

    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await notifyFounderOnBidOutcome(baseArgs);

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
    expect(body.subject.startsWith('Bid won:')).toBe(true);
    expect(body.subject).toContain('Network infrastructure upgrade');
    expect(body.subject).toContain('(SAM.gov)');
    expect(body.body).toContain('A bid was won.');
    expect(body.body).toContain('Opportunity: Network infrastructure upgrade');
    expect(body.body).toContain('Agency: Department of Veterans Affairs');
    expect(body.body).toContain('Source: SAM.gov');
    expect(body.body).toContain('Set-aside: SDVOSBC');
    expect(body.body).toContain('Recorded at: 2026-07-26 10:00:00 UTC');
    expect(body.body).toContain('Bid draft id: c11234567890abcdefghij');
    expect(body.html.startsWith('<p>A bid was won.</p>')).toBe(true);
    expect(body.html).toContain('<table');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders the Unison Global badge for UNISON source', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await notifyFounderOnBidOutcome({ ...baseArgs, source: 'UNISON' });

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
    expect(body.subject).not.toMatch(/\bSAM\b/);
    expect(body.body).toContain('Unison Global');
    expect(body.body).not.toContain('SAM.gov');
    expect(body.body).not.toMatch(/\bSAM\b/);
    expect(body.html).toContain('Unison Global');
    expect(body.html).not.toContain('SAM.gov');
    expect(body.html).not.toMatch(/\bSAM\b/);
  });

  it('uses the bid draft id as the subject title when the title is empty', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await notifyFounderOnBidOutcome({ ...baseArgs, title: '' });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const body = JSON.parse(String(init.body)) as { subject: string };
    expect(body.subject.startsWith('Bid won: c11234567890abcdefghij (SAM.gov)')).toBe(true);
  });

  it('strips newlines from the title and clamps it to <=120 chars', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    const tooLong = `Line1\nLine2 ${'x'.repeat(150)}`;
    await notifyFounderOnBidOutcome({ ...baseArgs, title: tooLong });

    const [, init] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit & { headers: Record<string, string> },
    ];
    const body = JSON.parse(String(init.body)) as { subject: string };
    expect(body.subject).not.toContain('\n');
    expect(body.subject.length).toBeLessThanOrEqual(`Bid won: ${'x'.repeat(120)} (SAM.gov)`.length);
    expect(body.subject).toContain('...');
  });

  it('renders "None" in the set-aside chip when isSetAside is false', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{}', 200));
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await notifyFounderOnBidOutcome({
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

  it('does not call fetch when POLSIA_API_KEY is unset and logs the missing key', async () => {
    currentEnv = { ...currentEnv, POLSIA_API_KEY: undefined };
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await notifyFounderOnBidOutcome(baseArgs);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      msg: string;
      keys: string;
    };
    expect(payload.msg).toBe('missing env');
    expect(payload.keys).toBe('POLSIA_API_KEY');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
    expect(serialized).not.toContain('Bearer');
  });

  it('does not call fetch when no admin founder exists and logs the missing lookup', async () => {
    prismaUserFindFirstMock.mockResolvedValue(null);
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await notifyFounderOnBidOutcome(baseArgs);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      msg: string;
    };
    expect(payload.msg).toBe('missing admin founder');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
    expect(serialized).not.toContain('Bearer');
  });

  it('absorbs a non-2xx proxy response: logs tagline + status + parsed error and returns successfully', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse('{"error":"rate_limited"}', 429));
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await expect(notifyFounderOnBidOutcome(baseArgs)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      tagline: string;
      status: number;
      error: string | null;
    };
    expect(payload.tagline).toBe('notify-founder-on-bid-outcome');
    expect(payload.status).toBe(429);
    expect(payload.error).toBe('rate_limited');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
    expect(serialized).not.toContain('Bearer');
  });

  it('absorbs a network rejection and returns successfully without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);
    await expect(notifyFounderOnBidOutcome(baseArgs)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = consoleErrorSpy.mock.calls[0]?.[0] as {
      tagline: string;
      status: number | null;
      error: string;
    };
    expect(payload.tagline).toBe('notify-founder-on-bid-outcome');
    expect(payload.status).toBeNull();
    expect(payload.error).toBe('connection refused');
    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serialized).not.toContain('company_test_key_aaaaaaaaaaaaa');
    expect(serialized).not.toContain('Bearer');
  });
});

describe('notifyFounderOnBidOutcome bearer-token leak check', () => {
  it('never logs the resolved POLSIA_API_KEY value across all failure modes', async () => {
    currentEnv = {
      POLSIA_API_BASE_URL: 'https://polsia.com',
      POLSIA_API_KEY: 'company_secret_value_xyz',
    };

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { notifyFounderOnBidOutcome } = await import(IMPORT_PATH);

    // 1) missing env
    {
      const prev = currentEnv.POLSIA_API_KEY;
      currentEnv = { ...currentEnv, POLSIA_API_KEY: undefined };
      prismaUserFindFirstMock.mockResolvedValue({ email: 'founder@example.com' });
      await notifyFounderOnBidOutcome(baseArgs);
      currentEnv = { ...currentEnv, POLSIA_API_KEY: prev };
    }

    // 2) missing admin lookup
    prismaUserFindFirstMock.mockResolvedValue(null);
    await notifyFounderOnBidOutcome(baseArgs);

    // 3) non-2xx
    prismaUserFindFirstMock.mockResolvedValue({ email: 'founder@example.com' });
    fetchSpy.mockResolvedValue(makeJsonResponse('{"error":"rate_limited"}', 429));
    await notifyFounderOnBidOutcome(baseArgs);

    // 4) network rejection
    fetchSpy.mockRejectedValue(new Error('connection refused'));
    await notifyFounderOnBidOutcome(baseArgs);

    const allSerialized = JSON.stringify(errSpy.mock.calls);
    expect(allSerialized).not.toContain('company_secret_value_xyz');

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
