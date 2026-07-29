// @polsia:user-owned — server-side morning digest builder. Computes the same
// qualifying / deadline-soon / open-draft numbers the live `/api/dashboard/summary`
// widget shows, picks the top 5 highest-confidence opportunities scored against
// the COMPANY_PROFILE, and POSTs a plain-text + HTML email to the founder via
// the platform email proxy. Runs from `jobs/daily-digest.ts`, which provides
// the recipient and the founder's `user.id` (or null on a brand-new deploy).
//
// Body policy:
//  - qualifying > 0, selected rows present  → top-N digest (max 5 rows, sorted by
//    confidence desc → urgency asc → title asc)
//  - qualifying > 0 but visible rows limited → trailing line "+<n> more qualifying"
//  - qualifying = 0                          → "no new qualifying" totals-only
//
// Return shape:
//   { status: 'OK' | 'EMPTY' | 'SKIPPED'; errorMessage: string | null;
//     subject: string | null }
//
//   - OK      → email sent successfully
//   - EMPTY   → email sent but the qualifying list was empty (totals-only body)
//   - SKIPPED → email send faulted; no throw (fail-open posture matching the
//               existing notifier on bid submission)
//
//   status is NEVER bubbled up as a thrown error from this module; the cron
//   entrypoint decides exit codes off the returned tuple.

import type { PrismaClient } from '@prisma/client';
import { COMPANY_PROFILE } from '@/lib/business/capability-statement';
import { getDashboardSummary } from '@/lib/business/dashboard-summary';
import {
  escapeHtml,
  formatUtc,
  sendFounderEmail,
  sourceBadge,
} from '@/lib/business/notifications/email';
import {
  DEADLINE_URGENCY_LABEL,
  DEADLINE_URGENCY_ORDER,
  type DeadlineUrgency,
  deadlineUrgency,
} from '@/lib/business/sam-deadline';
import { scoreSetAsideQualification } from '@/lib/business/set-aside';
import { siteUrl as derivedSiteUrl } from '@/lib/site';

const QUALIFYING_THRESHOLD = 0.5;
const MAX_ROWS = 5;

type DigestStatus = 'OK' | 'EMPTY' | 'SKIPPED';

export interface RunMorningDigestArgs {
  recipient: string;
  ownerUserId: string | null;
  now?: Date;
  siteUrl?: string;
}

export interface MorningDigestResult {
  status: DigestStatus;
  errorMessage: string | null;
  subject: string | null;
}

interface DigestRow {
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  source: 'SAM' | 'UNISON';
  dueDate: Date | null;
  topConfidence: number;
  urgency: DeadlineUrgency;
}

export async function runMorningDigest(args: RunMorningDigestArgs): Promise<MorningDigestResult> {
  const now = args.now ?? new Date();
  const siteUrl = (args.siteUrl ?? derivedSiteUrl).replace(/\/+$/, '');
  const recipient = args.recipient?.trim() ?? '';

  if (recipient.length === 0) {
    return {
      status: 'SKIPPED',
      errorMessage: 'recipient is empty',
      subject: null,
    };
  }

  const summary = await getDashboardSummary(args.ownerUserId, { now });

  const { prisma } = (await import('@/lib/db')) as { prisma: PrismaClient };

  const rows = await prisma.samOpportunity.findMany({
    select: {
      id: true,
      noticeId: true,
      title: true,
      agency: true,
      naicsCode: true,
      setAside: true,
      dueDate: true,
      source: true,
    },
  });

  const qualifying: DigestRow[] = [];
  for (const row of rows) {
    const quals = scoreSetAsideQualification(
      {
        noticeId: row.noticeId,
        title: row.title,
        agency: row.agency,
        naicsCode: row.naicsCode,
        setAside: row.setAside,
        placeOfPerformance: null,
      },
      COMPANY_PROFILE,
      { now },
    );
    const topConfidence = quals[0]?.confidence ?? 0;
    if (topConfidence < QUALIFYING_THRESHOLD) continue;
    qualifying.push({
      noticeId: row.noticeId,
      title: row.title,
      agency: row.agency,
      naicsCode: row.naicsCode,
      source: row.source === 'UNISON' ? 'UNISON' : 'SAM',
      dueDate: row.dueDate,
      topConfidence,
      urgency: deadlineUrgency(row.dueDate, now),
    });
  }

  qualifying.sort((a, b) => {
    if (a.topConfidence !== b.topConfidence) return b.topConfidence - a.topConfidence;
    const u = DEADLINE_URGENCY_ORDER[a.urgency] - DEADLINE_URGENCY_ORDER[b.urgency];
    if (u !== 0) return u;
    return a.title.localeCompare(b.title);
  });

  const dateLabel = formatUtc(now).slice(0, 10);
  const visible = qualifying.slice(0, MAX_ROWS);
  const empty = qualifying.length === 0;

  const subject = empty
    ? `Sam morning digest — ${dateLabel} (no new qualifying)`
    : `Sam morning digest — ${dateLabel}`;

  const body = empty
    ? buildEmptyBody(summary, now)
    : buildBody(visible, qualifying.length, summary, now, siteUrl);
  const html = empty
    ? buildEmptyHtml(summary, now)
    : buildHtml(visible, qualifying.length, summary, now, siteUrl);

  const sendResult = await sendFounderEmail({
    to: args.recipient,
    subject,
    body,
    html,
  });

  if (sendResult.status === null || sendResult.status >= 400) {
    return { status: 'SKIPPED', errorMessage: sendResult.error, subject };
  }

  return {
    status: empty ? 'EMPTY' : 'OK',
    errorMessage: null,
    subject,
  };
}

function buildBody(
  visible: DigestRow[],
  totalQualifying: number,
  summary: { qualifyingThisWeek: number; deadlineSoon: number; openBidDrafts: number },
  now: Date,
  siteUrl: string,
): string {
  const lines: string[] = [];
  lines.push(`Sam morning digest — ${formatUtc(now)}`);
  lines.push('');
  lines.push(`Qualifying this week: ${summary.qualifyingThisWeek}`);
  lines.push(`Deadlines in next 7 days: ${summary.deadlineSoon}`);
  lines.push(`Open bid drafts: ${summary.openBidDrafts}`);
  lines.push('');
  visible.forEach((row, idx) => {
    const labeledUrl = `${siteUrl}/sam/${encodeURIComponent(row.noticeId)}`;
    lines.push(`[${idx + 1}] ${sourceBadge(row.source)} — ${row.title} (NAICS ${row.naicsCode})`);
    lines.push(`Agency: ${row.agency}`);
    lines.push(`Deadline: ${DEADLINE_URGENCY_LABEL[row.urgency]}`);
    lines.push(`Link: ${labeledUrl}`);
    lines.push('');
  });
  if (totalQualifying > visible.length) {
    lines.push(
      `+${totalQualifying - visible.length} more qualifying rows — open dashboard for full list.`,
    );
  }
  return lines.join('\n').trimEnd();
}

function buildHtml(
  visible: DigestRow[],
  totalQualifying: number,
  summary: { qualifyingThisWeek: number; deadlineSoon: number; openBidDrafts: number },
  now: Date,
  siteUrl: string,
): string {
  const rowsHtml = visible
    .map((row, idx) => {
      const labeledUrl = `${siteUrl}/sam/${encodeURIComponent(row.noticeId)}`;
      return (
        `<tr>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;font-weight:600;">[${idx + 1}]</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;">${escapeHtml(sourceBadge(row.source))}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;">` +
        `<div style="font-weight:600;">${escapeHtml(row.title)}</div>` +
        `<div style="color:#555;font-size:13px;">${escapeHtml(row.agency)} · NAICS ${escapeHtml(row.naicsCode)}</div>` +
        `<div style="font-size:13px;margin-top:2px;"><a href="${escapeHtml(labeledUrl)}" style="color:#1a56db;text-decoration:underline;">${escapeHtml(labeledUrl)}</a></div>` +
        `</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;white-space:nowrap;">${escapeHtml(DEADLINE_URGENCY_LABEL[row.urgency])}</td>` +
        `</tr>`
      );
    })
    .join('');

  const totalsHtml =
    `<p style="margin:0 0 8px 0;">Qualifying this week: <strong>${summary.qualifyingThisWeek}</strong></p>` +
    `<p style="margin:0 0 8px 0;">Deadlines in next 7 days: <strong>${summary.deadlineSoon}</strong></p>` +
    `<p style="margin:0 0 16px 0;">Open bid drafts: <strong>${summary.openBidDrafts}</strong></p>`;

  const moreLine =
    totalQualifying > visible.length
      ? `<p style="margin-top:16px;color:#555;font-size:13px;">+${totalQualifying - visible.length} more qualifying rows — open dashboard for full list.</p>`
      : '';

  return (
    `<p style="margin:0 0 12px 0;font-weight:600;font-family:sans-serif;font-size:15px;">Sam morning digest — ${escapeHtml(formatUtc(now))}</p>` +
    `<div style="font-family:sans-serif;font-size:14px;">${totalsHtml}` +
    `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;width:100%;">${rowsHtml}</table>` +
    `${moreLine}` +
    `</div>`
  );
}

function buildEmptyBody(
  summary: { qualifyingThisWeek: number; deadlineSoon: number; openBidDrafts: number },
  now: Date,
): string {
  const lines: string[] = [];
  lines.push(`Sam morning digest — ${formatUtc(now)}`);
  lines.push('');
  lines.push(`Qualifying this week: ${summary.qualifyingThisWeek}`);
  lines.push(`Deadlines in next 7 days: ${summary.deadlineSoon}`);
  lines.push(`Open bid drafts: ${summary.openBidDrafts}`);
  lines.push('');
  lines.push(`No new qualifying opportunities overnight.`);
  return lines.join('\n').trimEnd();
}

function buildEmptyHtml(
  summary: { qualifyingThisWeek: number; deadlineSoon: number; openBidDrafts: number },
  now: Date,
): string {
  return (
    `<p style="margin:0 0 12px 0;font-weight:600;font-family:sans-serif;font-size:15px;">Sam morning digest — ${escapeHtml(formatUtc(now))}</p>` +
    `<div style="font-family:sans-serif;font-size:14px;">` +
    `<p style="margin:0 0 8px 0;">Qualifying this week: <strong>${summary.qualifyingThisWeek}</strong></p>` +
    `<p style="margin:0 0 8px 0;">Deadlines in next 7 days: <strong>${summary.deadlineSoon}</strong></p>` +
    `<p style="margin:0 0 16px 0;">Open bid drafts: <strong>${summary.openBidDrafts}</strong></p>` +
    `<p>No new qualifying opportunities overnight.</p>` +
    `</div>`
  );
}
