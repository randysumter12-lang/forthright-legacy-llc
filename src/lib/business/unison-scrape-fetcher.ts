// @polsia:user-owned — pure helpers for the Unison Global OpenBeta scraper:
// URL construction, date parsing, set-aside normalization, category
// classification, and the native-fetch entry point. Reuses the SAM helpers
// because the predicate shape is identical — both sources surface
// NAICS + award band eligibility. NO server-only imports — these helpers
// are unit-tested in jsdom via vitest (the `server-only` marker would fail
// jsdom resolution).
import type { SamCategory } from '@/lib/contracts/sam-opportunity';

export const UNISON_PUBLIC_BASE = 'https://api.unison.example.gov/buys';

// Mirror the SAM USER_AGENT identifier so reviewer-side tooling can spot
// Rigel Solutions requests in either source's logs.
export const UNISON_USER_AGENT =
  'RigelSolutions/0.1 (+ops; Unison Global OpenBeta scraper; rigel-solutions@polsia.io)';
export const UNISON_DEFAULT_LIMIT = 100;

// Unison payload exposes a `leadLagState` discriminator that maps onto our
// acceptance gates. LEAD = scheduled far enough out to draft against;
// LAG = close + already in-market (no fair-competition draft window).
export type UnisonLeadLagState = 'LEAD' | 'LAG';

export type RawUnisonBuy = Record<string, unknown>;

export interface NormalizedUnisonBuy {
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
  solicitationNumber: string | null;
  source: 'UNISON';
  unisonBuyId: string;
  unisonRevision: number;
  buyerType: string;
  leadLagState: string;
  activeTargetPrice: number | null;
  bidDecrement: number | null;
  lineItems: RawUnisonBuy[];
  metadata: Record<string, unknown> | null;
  rawJson: RawUnisonBuy;
}

export interface UnisonFetchOptions {
  postedFromDays?: number;
  limit?: number;
  offset?: number;
  fetchImpl?: typeof fetch;
}

// ─── URL construction (pure, exported for tests) ────────────────────────────

export function buildBuyUrl(opts: {
  naicsList: readonly string[];
  postedFrom: string;
  postedTo: string;
  apiKey?: string;
  offset?: number;
  limit?: number;
}): { url: string; headers: HeadersInit } {
  const params = new URLSearchParams();
  params.set('naics', opts.naicsList.join(','));
  params.set('postedFrom', opts.postedFrom);
  params.set('postedTo', opts.postedTo);
  params.set('limit', String(opts.limit ?? UNISON_DEFAULT_LIMIT));
  if (opts.offset && opts.offset > 0) params.set('offset', String(opts.offset));
  const headers: Record<string, string> = {
    'User-Agent': UNISON_USER_AGENT,
    Accept: 'application/json',
  };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  return { url: `${UNISON_PUBLIC_BASE}?${params.toString()}`, headers };
}

// ─── SAM helpers re-used by this fetcher (single source of truth) ─────────
// Importing from the SAM module keeps the canonical implementation single-
// sourced; we also re-export them for downstream parity so callers don't
// reach across two fetcher modules for shared utilities.
import {
  AWARD_CEILING,
  AWARD_FLOOR,
  classifyCategory,
  DEFAULT_LIMIT,
  normalizeSetAside,
  parseFlexibleDate,
  USER_AGENT as SAM_USER_AGENT,
  TARGET_NAICS,
  toSamDate,
} from '@/lib/business/sam-scrape-fetcher';

export {
  AWARD_CEILING,
  AWARD_FLOOR,
  TARGET_NAICS,
  SAM_USER_AGENT,
  DEFAULT_LIMIT,
  classifyCategory,
  normalizeSetAside,
  parseFlexibleDate,
  toSamDate as toUnisonDate,
};

// ─── Single-row normalization (pure, exported for tests) ────────────────────

const LEAD_LAG_STATES: ReadonlySet<UnisonLeadLagState> = new Set<UnisonLeadLagState>([
  'LEAD',
  'LAG',
]);

export function parseBuy(row: RawUnisonBuy): NormalizedUnisonBuy | null {
  const noticeId = pickString(row, [
    'noticeId',
    'notice_id',
    'solicitationNumber',
    'solicitation_number',
  ]);
  const title = pickString(row, ['title', 'buy_title', 'subject']);
  const agency = pickString(row, [
    'agency',
    'buyer',
    'buyer_name',
    'department',
    'organizationName',
  ]);
  const naicsCode = pickString(row, ['naics', 'naicsCode', 'naics_code']);
  if (!noticeId || !title || !agency || !naicsCode) return null;

  // Reuse the SAM helpers for date / set-aside / category — both fetcher
  // families keep canonical normalization single-sourced.
  const dueDate = parseFlexibleDate(
    pickAny(row, ['responseDeadline', 'dueDate', 'due_date', 'closeDate', 'deadline']),
  );
  const postedDate = parseFlexibleDate(pickAny(row, ['postedDate', 'posted_date', 'publishDate']));

  const activeTargetPriceRaw = pickAny(row, [
    'activeTargetPrice',
    'active_target_price',
    'targetPrice',
    'target_price',
  ]);
  const activeTargetPrice =
    activeTargetPriceRaw == null || activeTargetPriceRaw === ''
      ? null
      : Number.isFinite(Number(activeTargetPriceRaw))
        ? Number(activeTargetPriceRaw)
        : null;

  // The $3.5K–$10K micro-purchase band maps onto `activeTargetPrice` for Unison
  // (it's the auction's starting target, not the prior-phase SAM award ceiling).
  // Keep both semantics for the read API; the orchestrator band-gates on this.
  const awardValueRaw = pickAny(row, [
    'awardValue',
    'award_value',
    'estimatedValue',
    'value',
    'price',
  ]);
  const awardValue =
    awardValueRaw == null || awardValueRaw === ''
      ? null
      : Number.isFinite(Number(awardValueRaw))
        ? Number(awardValueRaw)
        : null;

  const setAside = normalizeSetAside(
    pickAny(row, ['setAside', 'set_aside', 'typeOfSetAside', 'setAsideType']),
  );
  const isSetAside = setAside !== null;

  const description = pickString(row, ['description', 'buyDescription', 'synopsis']);
  const uiLink = pickString(row, ['uiLink', 'ui_link', 'buyLink', 'link']);

  const unisonBuyIdRaw = pickString(row, ['buyId', 'buy_id', 'unisonBuyId']);
  // Accept both raw-API keys (revision / rev) and the already-normalized
  // unisonRevision — when processing row-level logic in the orchestrator the
  // payload may have been partially normalized upstream.
  const unisonRevisionRaw = Number(pickAny(row, ['revision', 'rev', 'unisonRevision']));
  const buyerType = pickString(row, ['buyerType', 'buyer_type']) ?? 'Federal';
  const leadLagStateRaw = pickString(row, ['leadLagState', 'lead_lag_state']) ?? 'LEAD';
  const leadLagState = LEAD_LAG_STATES.has(leadLagStateRaw as UnisonLeadLagState)
    ? (leadLagStateRaw as UnisonLeadLagState)
    : 'LEAD';

  const bidDecrementRaw = pickAny(row, ['bidDecrement', 'bid_decrement']);
  const bidDecrement =
    bidDecrementRaw == null || bidDecrementRaw === ''
      ? null
      : Number.isFinite(Number(bidDecrementRaw))
        ? Number(bidDecrementRaw)
        : null;

  const lineItemsRaw = pickAny(row, ['lineItems', 'line_items', 'items']);
  const lineItems = Array.isArray(lineItemsRaw) ? (lineItemsRaw as RawUnisonBuy[]) : [];

  const solicitationNumber = pickString(row, ['solicitationNumber', 'solicitation_number']) ?? null;

  const metadataRaw = pickAny(row, ['metadata']);
  const metadata =
    metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : null;

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
    solicitationNumber,
    source: 'UNISON',
    unisonBuyId: unisonBuyIdRaw ?? noticeId,
    unisonRevision: Number.isFinite(unisonRevisionRaw) ? unisonRevisionRaw : 1,
    buyerType,
    leadLagState,
    activeTargetPrice,
    bidDecrement,
    lineItems,
    metadata,
    rawJson: row,
  };
}

function pickAny(row: RawUnisonBuy, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return null;
}

function pickString(row: RawUnisonBuy, keys: readonly string[]): string | null {
  const v = pickAny(row, keys);
  return v == null ? null : String(v);
}

// ─── Fetch + parse (exported for tests; upsert path lives in unison-scraper.ts) ─

export async function fetchUnisonBuys(opts: UnisonFetchOptions = {}): Promise<{
  records: NormalizedUnisonBuy[];
  status: 'OK' | 'RATE_LIMITED' | 'ERROR';
  errorMessage: string | null;
}> {
  const now = new Date();
  const days = opts.postedFromDays ?? 1;
  const postedFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const { url, headers } = buildBuyUrl({
    naicsList: ['541512', '541511', '541519', '541690', '541618', '541330'],
    postedFrom: toSamDate(postedFrom),
    postedTo: toSamDate(now),
    offset: opts.offset,
    limit: opts.limit ?? UNISON_DEFAULT_LIMIT,
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
    return { records: [], status: 'RATE_LIMITED', errorMessage: 'Unison returned HTTP 429' };
  }
  if (!res.ok) {
    return {
      records: [],
      status: 'ERROR',
      errorMessage: `Unison returned HTTP ${res.status}`,
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
  const rows = extractBuys(json);
  const records: NormalizedUnisonBuy[] = [];
  for (const row of rows) {
    const rec = parseBuy(row);
    if (rec) records.push(rec);
  }
  return { records, status: 'OK', errorMessage: null };
}

function extractBuys(json: unknown): RawUnisonBuy[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as Record<string, unknown>;
  // OpenBeta-style: { buys: [...] }. Also tolerate `items` / `data` wrappers.
  const candidates: unknown[] = [obj.buys, obj.items, obj.data, obj.results];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as RawUnisonBuy[];
  }
  if (Array.isArray(obj)) return obj as RawUnisonBuy[];
  return [];
}
