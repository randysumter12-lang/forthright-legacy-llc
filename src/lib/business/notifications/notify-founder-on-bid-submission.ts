// @polsia:user-owned — server-only side-effect that pings the founder the
// instant a bid draft transitions pending → submitted. Reads nothing from
// the DB itself; the route passes every column it needs so this helper is
// a pure POST to the platform email proxy. It MUST NOT throw — proxy faults
// absorb and the helper returns successfully so the user's POST still
// answers 200. The relevant swallow boundary is here, at the `fetch` call.
// Reachable only from the route handler that already imports `server-only`,
// so adding the marker here would only break the jsdom vitest path — same
// trade-off documented in src/lib/business/sam-scraper.ts.

import {
  clampTitle,
  escapeHtml,
  formatUtc,
  sendEmail,
  sourceBadge,
} from '@/lib/business/notifications/email';
import { DEADLINE_URGENCY_LABEL, deadlineUrgency } from '@/lib/business/sam-deadline';
import { env } from '@/lib/env';

export interface NotifyFounderOnBidSubmissionArgs {
  bidDraftId: string;
  ownerUserId: string;
  actorId: string;
  source: 'SAM' | 'UNISON';
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  setAside: string | null;
  isSetAside: boolean;
  dueDate: Date | string | null;
  submittedAt: Date;
}

function buildPlainBody(args: NotifyFounderOnBidSubmissionArgs): string {
  const badge = sourceBadge(args.source);
  const lines: string[] = [];
  lines.push(`A bid draft was submitted.`);
  lines.push('');
  lines.push(`Opportunity: ${args.title}`);
  lines.push(`Agency: ${args.agency}`);
  lines.push(`NAICS: ${args.naicsCode || 'N/A'}`);
  lines.push(`Source: ${badge}`);
  lines.push(`Notice ID: ${args.noticeId}`);
  lines.push(`Set-aside: ${args.isSetAside ? args.setAside || 'N/A' : 'None'}`);
  if (args.dueDate) {
    const bucket = deadlineUrgency(args.dueDate, new Date());
    const label = DEADLINE_URGENCY_LABEL[bucket];
    lines.push(`Deadline urgency: ${label}`);
  } else {
    lines.push(`Deadline urgency: ${DEADLINE_URGENCY_LABEL.UNKNOWN}`);
  }
  lines.push(`Submitted at: ${formatUtc(args.submittedAt)}`);
  lines.push(`Bid draft id: ${args.bidDraftId}`);
  lines.push(`Owner user id: ${args.ownerUserId}`);
  lines.push(`Actor user id: ${args.actorId}`);
  return lines.join('\n');
}

function buildHtmlBody(args: NotifyFounderOnBidSubmissionArgs): string {
  const badge = sourceBadge(args.source);
  const label = args.dueDate
    ? DEADLINE_URGENCY_LABEL[deadlineUrgency(args.dueDate, new Date())]
    : DEADLINE_URGENCY_LABEL.UNKNOWN;
  const setAsideCell = args.isSetAside ? escapeHtml(args.setAside ?? 'N/A') : 'None';
  const rows: Array<[string, string]> = [
    ['Opportunity', escapeHtml(args.title)],
    ['Agency', escapeHtml(args.agency)],
    ['NAICS', escapeHtml(args.naicsCode || 'N/A')],
    ['Source', escapeHtml(badge)],
    ['Notice ID', escapeHtml(args.noticeId)],
    ['Set-aside', setAsideCell],
    ['Deadline urgency', escapeHtml(label)],
    ['Submitted at', escapeHtml(formatUtc(args.submittedAt))],
    ['Bid draft id', escapeHtml(args.bidDraftId)],
    ['Owner user id', escapeHtml(args.ownerUserId)],
    ['Actor user id', escapeHtml(args.actorId)],
  ];
  const tableRows = rows
    .map(
      ([label, value]: [string, string]) =>
        `<tr><td style="padding:4px 8px;font-weight:600;border-bottom:1px solid #eee;">${escapeHtml(label)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${value}</td></tr>`,
    )
    .join('');
  return `<p>A bid draft has been submitted.</p><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">${tableRows}</table>`;
}

export async function notifyFounderOnBidSubmission(
  args: NotifyFounderOnBidSubmissionArgs,
): Promise<void> {
  const apiKey = env.POLSIA_API_KEY;
  const recipient = env.POLSIA_OWNER_EMAIL;
  if (!apiKey || !recipient) {
    const _missingKeys = [apiKey ? null : 'POLSIA_API_KEY', recipient ? null : 'POLSIA_OWNER_EMAIL']
      .filter((k): k is string => Boolean(k))
      .join(',');
    return;
  }

  const subject = `Bid submitted: ${clampTitle(args.title, args.bidDraftId)} (${sourceBadge(args.source)})`;
  const body = buildPlainBody(args);
  const html = buildHtmlBody(args);

  try {
    const result = await sendEmail({ to: recipient, subject, body, html });
    if (result.status !== null && result.status >= 400) {
    }
  } catch (_e) {}
}
