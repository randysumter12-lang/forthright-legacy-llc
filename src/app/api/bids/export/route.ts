// @polsia:user-owned — GET /api/bids/export. Streams the caller's submitted
// bid inventory as a CSV with the same column order as the /submitted-bids
// table — title, agency, source, setAside, dueDate, submittedAt, outcome,
// auditCount. RFC-4180 quoting (handled by src/lib/csv.ts); CRLF line
// endings; UTF-8 BOM prefix so Excel auto-detects encoding. CRLF + BOM is
// the canonical Excel CSV.
//
// Auth posture mirrors POST /api/bids/<id>/outcome:
//   - `requireAuth` → 401 envelope if no session
//   - `requireSubscription('PROFESSIONAL')` → 402 envelope if below tier
// Ownership scoping is server-side (`ownerUserId: user.id`) — the client
// never supplies ids. `outcome` is narrowed to the same three-value literal
// union the JSON list endpoint exposes.
//
// Why a CSV route (and not a column on /api/bids): the brief asks for a
// downloadable file with a deterministic `Content-Disposition` filename;
// baking that into the JSON list would force every browser through the
// blob dance. A dedicated endpoint keeps the JSON contract pure and the
// download a single click on a known URL.
import 'server-only';
import { toCsvRow } from '@/lib/csv';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { requireSubscription } from '@/lib/require-subscription';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  'title',
  'agency',
  'source',
  'setAside',
  'dueDate',
  'submittedAt',
  'outcome',
  'auditCount',
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
    await requireSubscription(req, 'PROFESSIONAL');
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.bidDraft.findMany({
    where: {
      ownerUserId: user.id,
      status: 'SUBMITTED',
    },
    orderBy: [{ submittedAt: 'desc' }],
    include: {
      samOpportunity: true,
    },
  });

  const source = (oppSource: string | null | undefined): string =>
    oppSource === 'UNISON' ? 'UNISON' : 'SAM';

  // Narrow the BidOutcome enum to the contract literal union — same rule
  // as GET /api/bids. If a legacy row carries a value outside the enum we
  // simply write an empty cell rather than crash the whole export.
  const outcome = (raw: string | null | undefined): string =>
    raw === 'WON' || raw === 'LOST' || raw === 'NO_RESPONSE' ? raw : '';

  const lines: string[] = [toCsvRow(COLUMNS as unknown as string[])];
  for (const row of rows) {
    const opp = row.samOpportunity;
    lines.push(
      toCsvRow([
        opp?.title ?? '',
        opp?.agency ?? '',
        source(opp?.source),
        opp?.setAside ?? '',
        opp?.dueDate ? opp.dueDate.toISOString() : '',
        row.submittedAt ? row.submittedAt.toISOString() : '',
        outcome(row.outcome),
        Array.isArray(row.submissionAudit) ? String(row.submissionAudit.length) : '0',
      ]),
    );
  }

  // `\r\n` separator per row (CRLF — Excel canonical); the BOM prefix tells
  // Excel the stream is UTF-8 so non-ASCII titles render correctly.
  const body = `﻿${lines.join('\r\n')}\r\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="submitted-bids-${todayStamp()}.csv"`,
      // Prevent any intermediary (CDN, proxy) from re-encoding the bytes —
      // BOM + CRLF must arrive intact so Excel reads them as Latin-1 / UTF-8.
      'Cache-Control': 'no-store',
    },
  });
}
