// @polsia:user-owned — list endpoint for scraped SAM.gov opportunities.
// Reads from Postgres via the framework Prisma singleton, parses the response
// through SamOpportunityList so client + server share one contract.
import 'server-only';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  type SamListErrorKind,
  type SamOpportunityItem,
  SamOpportunityList,
  SamOpportunityQuery,
} from '@/lib/contracts/sam-opportunity';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsedQuery = SamOpportunityQuery.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    setAside: url.searchParams.get('setAside') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    source: url.searchParams.get('source') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const { limit, category, setAside, cursor, source } = parsedQuery.data;

  const where: Prisma.SamOpportunityWhereInput = {};
  if (category) where.category = category;
  if (typeof setAside === 'boolean') where.isSetAside = setAside;
  if (source) where.source = source;

  let rows: Awaited<ReturnType<typeof prisma.samOpportunity.findMany>>;
  let lastRun: Awaited<ReturnType<typeof prisma.samScrapeRun.findFirst>>;
  try {
    rows = await prisma.samOpportunity.findMany({
      where,
      orderBy: [{ postedDate: 'desc' }, { noticeId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { noticeId: cursor }, skip: 1 } : {}),
      include: {
        bidDraft: {
          select: { status: true },
        },
      },
    });

    lastRun = await prisma.samScrapeRun.findFirst({ orderBy: { startedAt: 'desc' } });
  } catch (err) {
    // Single diagnostic surface for any Prisma throw on this route — the
    // client island parses `err.cause` to render the OPERATOR-facing code +
    // message instead of the misleading generic "verify DATABASE_URL" hint.
    // 503 (Service Unavailable) reads correctly at the load-balancer layer
    // and isn't retried indefinitely by apiFetch's single-attempt loop.
    const e = err as { code?: string; message?: string };
    const code = typeof e?.code === 'string' ? e.code : 'UNKNOWN';
    const message = typeof e?.message === 'string' ? e.message : String(err);
    return NextResponse.json(
      {
        error: 'sam_list_failed',
        diagnostic: { code, message, kind: classifyPrismaCode(code) },
      },
      { status: 503 },
    );
  }

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (sliced[sliced.length - 1]?.noticeId ?? null) : null;
  const items: SamOpportunityItem[] = sliced.map(toContract);

  const payload = SamOpportunityList.parse({
    items,
    nextCursor,
    lastRun: lastRun
      ? {
          status: (lastRun.status === 'RUNNING' ||
          lastRun.status === 'OK' ||
          lastRun.status === 'ERROR' ||
          lastRun.status === 'RATE_LIMITED'
            ? lastRun.status
            : 'UNKNOWN') as 'RUNNING' | 'OK' | 'ERROR' | 'RATE_LIMITED' | 'UNKNOWN',
          startedAt: lastRun.startedAt?.toISOString() ?? null,
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          fetchedCount: lastRun.fetchedCount,
          upsertedCount: lastRun.upsertedCount,
          errorMessage: lastRun.errorMessage,
          trigger: lastRun.trigger,
          source: lastRun.source ?? undefined,
        }
      : undefined,
  });

  return NextResponse.json(payload);
}

function toContract(row: {
  id: string;
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  dueDate: Date | null;
  postedDate: Date | null;
  awardValue: unknown;
  setAside: string | null;
  isSetAside: boolean;
  category: string;
  description: string | null;
  uiLink: string | null;
  scrapedAt: Date;
  source?: string;
  unisonBuyId?: string | null;
  unisonRevision?: number | null;
  buyerType?: string | null;
  leadLagState?: string | null;
  activeTargetPrice?: unknown;
  bidDecrement?: unknown;
  lineItems?: unknown;
  metadata?: unknown;
  solicitationNumber?: string | null;
  bidDraft?: { status: string } | null;
}): SamOpportunityItem {
  const awardValue =
    row.awardValue == null
      ? null
      : typeof row.awardValue === 'number'
        ? row.awardValue
        : Number(row.awardValue);
  const activeTargetPrice =
    row.activeTargetPrice == null
      ? null
      : typeof row.activeTargetPrice === 'number'
        ? row.activeTargetPrice
        : Number(row.activeTargetPrice);
  const bidDecrement =
    row.bidDecrement == null
      ? null
      : typeof row.bidDecrement === 'number'
        ? row.bidDecrement
        : Number(row.bidDecrement);
  // Treat source discriminator defensively — legacy rows may have a non-matching value
  // or an empty string; the contract defaults to 'SAM' if absent.
  const sourceCandidate = row.source === 'UNISON' ? 'UNISON' : 'SAM';
  const draftStatus =
    row.bidDraft?.status === 'DRAFT' ||
    row.bidDraft?.status === 'REVIEW' ||
    row.bidDraft?.status === 'SUBMITTED'
      ? (row.bidDraft.status as 'DRAFT' | 'REVIEW' | 'SUBMITTED')
      : undefined;
  return {
    id: row.id,
    noticeId: row.noticeId,
    title: row.title,
    agency: row.agency,
    naicsCode: row.naicsCode,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    postedDate: row.postedDate ? row.postedDate.toISOString() : null,
    awardValue: Number.isFinite(awardValue) ? awardValue : null,
    setAside: row.setAside,
    isSetAside: row.isSetAside,
    category: row.category as SamOpportunityItem['category'],
    description: row.description,
    uiLink: row.uiLink,
    scrapedAt: row.scrapedAt.toISOString(),
    source: sourceCandidate,
    unisonBuyId: row.unisonBuyId ?? null,
    unisonRevision: row.unisonRevision ?? null,
    buyerType: row.buyerType ?? null,
    leadLagState: row.leadLagState ?? null,
    activeTargetPrice: Number.isFinite(activeTargetPrice) ? activeTargetPrice : null,
    bidDecrement: Number.isFinite(bidDecrement) ? bidDecrement : null,
    lineItems: Array.isArray(row.lineItems)
      ? (row.lineItems as Array<Record<string, unknown>>)
      : null,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    solicitationNumber: row.solicitationNumber ?? null,
    draftStatus,
  };
}

// Group Prisma error codes into the decision branches the operator actually
// has:
//   - schema_mismatch  → re-push schema; columns/tables out of sync.
//   - connectivity     → check Neon / pooler posture.
//   - other            → surface the raw code+message; humans investigate.
// Codes per https://www.prisma.io/docs/orm/reference/error-reference.
function classifyPrismaCode(code: string): SamListErrorKind {
  switch (code) {
    case 'P2021':
    case 'P2022':
      return 'schema_mismatch';
    case 'P1001':
    case 'P1017':
      return 'connectivity';
    default:
      return 'other';
  }
}
