// @polsia:user-owned — pure helpers for the SAM.gov micro-purchase scraper:
// URL construction, date parsing, set-aside normalization, category
// classification, and the native-fetch entry point. NO server-only imports —
// these helpers are unit-tested in jsdom via vitest (the `server-only`
// marker would fail jsdom resolution).
import type { SamCategory } from '@/lib/contracts/sam-opportunity';

// IT services + CMMC + consulting NAICS list per the brief.
export const TARGET_NAICS = [
  '541512', // Computer Systems Design Services
  '541511', // Custom Computer Programming
  '541519', // Other Computer Related Services
  '541690', // Other Scientific and Technical Consulting
  '541618', // Other Management Consulting
  '541330', // Engineering Services (often tech / CMMC-adjacent)
] as const;

// $3.5K–$10K simplified acquisition micro-purchase band.
export const AWARD_FLOOR = 3500;
export const AWARD_CEILING = 10000;

export const USER_AGENT =
  'RigelSolutions/0.1 (+ops; SAM.gov micro-purchase scraper; rigel-solutions@polsia.io)';
export const DEFAULT_LIMIT = 100;

// Public SAM.gov search base; v2 takes `X-Api-Key` (api.data.gov gateway), the
// v1 endpoint exposes the same payload publicly. We hit v2 with the key when
// present, v1 unauthenticated otherwise.
const SAM_SEARCH_BASE_V2 = 'https://api.sam.gov/opportunities/v2/search';
const SAM_SEARCH_BASE_V1 = 'https://api.sam.gov/data-services/v1/ops/sam-gov';

export type RawSamRow = Record<string, unknown>;

export interface NormalizedSamRecord {
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  dueDate: Date | null;
  postedDate: Date | null;
  awardValue: number | null;
  setAside: string | null;
  isSetAside: boolean;
  category: SamCategory;
  description: string | null;
  uiLink: string | null;
  rawJson: RawSamRow;
}

export interface SamFetchOptions {
  postedFromDays?: number;
  limit?: number;
  offset?: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

// ─── URL construction (pure, exported for tests) ────────────────────────────

export function buildSearchUrl(
  opts: {
    postedFrom: string;
    postedTo: string;
    apiKey?: string;
    offset?: number;
    limit?: number;
  } = { postedFrom: '', postedTo: '' },
): { url: string; base: string; headers: HeadersInit } {
  const hasKey = Boolean(opts.apiKey);
  const base = hasKey ? SAM_SEARCH_BASE_V2 : SAM_SEARCH_BASE_V1;
  const params = new URLSearchParams();
  params.set('naicsCode', TARGET_NAICS.join(','));
  params.set('awardFloor', String(AWARD_FLOOR));
  params.set('awardCeiling', String(AWARD_CEILING));
  params.set('postedFrom', opts.postedFrom);
  params.set('postedTo', opts.postedTo);
  params.set('limit', String(opts.limit ?? DEFAULT_LIMIT));
  if (opts.offset && opts.offset > 0) params.set('offset', String(opts.offset));
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
  if (opts.apiKey) headers['X-Api-Key'] = opts.apiKey;
  return { url: `${base}?${params.toString()}`, base, headers };
}

// ─── Date parsing helpers ────────────────────────────────────────────────────

export function parseFlexibleDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  // SAM.gov often returns MM/DD/YYYY; sometimes ISO.
  const isoCandidate = new Date(raw);
  if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Set-aside normalization ────────────────────────────────────────────────

// Maps SAM.gov's free-form typeOfSetAside values to a normalized short code.
// Returns null when the row is genuinely unrestricted.
const SET_ASIDE_MAP: Record<string, string> = {
  SBA: 'SBA',
  'Small Business': 'SBA',
  '8AN': '8A',
  '8(a)': '8A',
  WOSB: 'WOSB',
  'Women-Owned Small Business': 'WOSB',
  EDWOSB: 'EDWOSB',
  SDVOSB: 'SDVOSBC',
  'Service-Disabled Veteran-Owned Small Business': 'SDVOSBC',
  HZC: 'HUBZone',
  HUBZone: 'HUBZone',
};

export function normalizeSetAside(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || /^no\s*set/i.test(raw) || /^none$/i.test(raw)) return null;
  const upper = raw.toUpperCase();
  if (SET_ASIDE_MAP[upper]) return SET_ASIDE_MAP[upper];
  if (SET_ASIDE_MAP[raw]) return SET_ASIDE_MAP[raw];
  // Trim long descriptive strings to first 32 chars to keep the badge compact.
  return raw.length <= 32 ? raw : raw.slice(0, 32);
}

// ─── Category classification ────────────────────────────────────────────────

const CMMC_TITLE_RE =
  /\b(cmmc|cybersecurity maturity model|cyber maturity model|gap assess|pre-?review|ra\s?assessment)\b/i;
const CONSULTING_TITLE_RE =
  /\b(consult|advisory|strategic|operations? review|process optim|feasibility|business case)\b/i;
const IT_TITLE_RE =
  /\b(it |information tech|software|network|cloud|devops|system|platform|data|engineer|developer|infra|coding|programming|cyber|admin)\b/i;

export function classifyCategory(naicsCode: string, title: string): SamCategory {
  if (CMMC_TITLE_RE.test(title)) return 'CMMC';
  if (CONSULTING_TITLE_RE.test(title) && (naicsCode === '541690' || naicsCode === '541618'))
    return 'CONSULTING';
  if (naicsCode === '541690' || naicsCode === '541618') return 'CONSULTING';
  if (
    naicsCode === '541512' ||
    naicsCode === '541511' ||
    naicsCode === '541519' ||
    naicsCode === '541330'
  )
    return 'IT_SERVICES';
  void IT_TITLE_RE; // reserved for future category nudges
  return 'OTHER';
}

// ─── Single-row normalization (pure, exported for tests) ────────────────────

export function parseOpportunity(row: RawSamRow): NormalizedSamRecord | null {
  const noticeId = pickString(row, [
    'noticeId',
    'notice_id',
    'solicitationNumber',
    'solicitation_number',
    'noticeNumber',
    'notice_number',
  ]);
  const title = pickString(row, ['title', 'opportunityTitle', 'subject']);
  const agency = pickString(row, [
    'agency',
    'department',
    'fullParentPathName',
    'organizationName',
    'departmentName',
  ]);
  const naicsCode = pickString(row, ['naicsCode', 'naics_code', 'naics', 'primaryNaicsCode']);
  if (!noticeId || !title || !agency || !naicsCode) return null;

  const dueDate = parseFlexibleDate(
    pickAny(row, ['responseDeadLine', 'deadline', 'dueDate', 'due_date', 'closeDate']),
  );
  const postedDate = parseFlexibleDate(
    pickAny(row, ['postedDate', 'posted_date', 'publishDate', 'publish_date']),
  );

  const awardValueRaw = pickAny(row, [
    'awardAmount',
    'award_amount',
    'estimatedValue',
    'awardValue',
    'value',
  ]);
  const awardValue =
    awardValueRaw == null || awardValueRaw === ''
      ? null
      : Number.isFinite(Number(awardValueRaw))
        ? Number(awardValueRaw)
        : null;

  const setAsideRaw = pickAny(row, ['typeOfSetAside', 'typeOfSetAsideDescription', 'setAside']);
  const setAside = normalizeSetAside(setAsideRaw);
  const isSetAside = setAside !== null;

  const description = pickString(row, [
    'description',
    'opportunityDescription',
    'solicitationDescription',
    'synopsis',
  ]);

  const uiLink = pickString(row, ['uiLink', 'ui_link', 'opportunityLink', 'link']);

  const category = classifyCategory(naicsCode, title);

  return {
    noticeId,
    title,
    agency,
    naicsCode,
    dueDate,
    postedDate,
    awardValue,
    setAside,
    isSetAside,
    category,
    description,
    uiLink,
    rawJson: row,
  };
}

function pickAny(row: RawSamRow, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return null;
}

export function pickString(row: RawSamRow, keys: readonly string[]): string | null {
  const v = pickAny(row, keys);
  return v == null ? null : String(v);
}

// ─── Fetch + parse (exported for tests; the runtime upsert path lives in
//     sam-scraper.ts which owns the Prisma singleton) ───────────────────────

export async function fetchSamOpportunities(
  envOverride: { apiKey?: string | undefined } | undefined,
  opts: SamFetchOptions = {},
): Promise<{
  records: NormalizedSamRecord[];
  status: 'OK' | 'RATE_LIMITED' | 'ERROR';
  errorMessage: string | null;
}> {
  const now = new Date();
  const days = opts.postedFromDays ?? 1;
  const postedFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const { url, headers } = buildSearchUrl({
    postedFrom: toSamDate(postedFrom),
    postedTo: toSamDate(now),
    apiKey: opts.apiKey ?? envOverride?.apiKey,
    limit: opts.limit ?? DEFAULT_LIMIT,
    offset: opts.offset,
  });
  const fetcher = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetcher(url, { method: 'GET', headers });
  } catch (e) {
    return {
      records: [],
      status: 'ERROR',
      errorMessage: `network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (res.status === 429) {
    return { records: [], status: 'RATE_LIMITED', errorMessage: 'SAM.gov returned HTTP 429' };
  }
  if (!res.ok) {
    return {
      records: [],
      status: 'ERROR',
      errorMessage: `SAM.gov returned HTTP ${res.status}`,
    };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    return {
      records: [],
      status: 'ERROR',
      errorMessage: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const rows = extractRows(json);
  const records: NormalizedSamRecord[] = [];
  for (const row of rows) {
    const rec = parseOpportunity(row);
    if (rec) records.push(rec);
  }
  return { records, status: 'OK', errorMessage: null };
}

function extractRows(json: unknown): RawSamRow[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as Record<string, unknown>;
  // v2 returns { opportunitiesData: [...] }; v1 returns { opportunities: [...] } or an array.
  const candidates: unknown[] = [obj.opportunitiesData, obj.opportunities, obj.results, obj.data];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as RawSamRow[];
    if (c && typeof c === 'object' && Array.isArray((c as { items?: unknown }).items)) {
      return (c as { items: RawSamRow[] }).items;
    }
  }
  if (Array.isArray(obj)) return obj as RawSamRow[];
  return [];
}

export function toSamDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
