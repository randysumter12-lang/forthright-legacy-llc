// @polsia:user-owned — server-only side-effect that pings the founder the
// instant a bid draft gets a terminal `WON` outcome stamped. Reads nothing
// from the DB itself beyond the admin-founder lookups; the route passes every
// column it needs so this helper is a pure POST to the platform email proxy.
// It MUST NOT throw — proxy faults absorb and the helper returns successfully
// so the route's POST still answers 200 with the outcome row commit. The
// relevant swallow boundary is here, around the `sendEmail` call. Reachable
// only from the route handler that already imports `server-only`, so adding
// the marker here would only break the jsdom vitest path — same trade-off
// documented in src/lib/business/sam-scraper.ts.

import {
  clampTitle,
  escapeHtml,
  formatUtc,
  sendEmail,
  sourceBadge,
} from '@/lib/business/notifications/email';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export interface NotifyFounderOnBidOutcomeArgs {
  bidDraftId: string;
  source: 'SAM' | 'UNISON';
  title: string;
  agency: string;
  setAside: string | null;
  isSetAside: boolean;
  outcomeAt: Date;
}

function buildPlainBody(args: NotifyFounderOnBidOutcomeArgs): string {
  const badge = sourceBadge(args.source);
  const lines: string[] = [];
  lines.push(`A bid was won.`);
  lines.push('');
  lines.push(`Opportunity: ${args.title}`);
  lines.push(`Agency: ${args.agency}`);
  lines.push(`Source: ${badge}`);
  lines.push(`Set-aside: ${args.isSetAside ? args.setAside || 'N/A' : 'None'}`);
  lines.push(`Recorded at: ${formatUtc(args.outcomeAt)}`);
  lines.push(`Bid draft id: ${args.bidDraftId}`);
  return lines.join('\n');
}

function buildHtmlBody(args: NotifyFounderOnBidOutcomeArgs): string {
  const badge = sourceBadge(args.source);
  const setAsideCell = args.isSetAside ? escapeHtml(args.setAside ?? 'N/A') : 'None';
  const rows: Array<[string, string]> = [
    ['Opportunity', escapeHtml(args.title)],
    ['Agency', escapeHtml(args.agency)],
    ['Source', escapeHtml(badge)],
    ['Set-aside', setAsideCell],
    ['Recorded at', escapeHtml(formatUtc(args.outcomeAt))],
    ['Bid draft id', escapeHtml(args.bidDraftId)],
  ];
  const tableRows = rows
    .map(
      ([label, value]: [string, string]) =>
        `<tr><td style="padding:4px 8px;font-weight:600;border-bottom:1px solid #eee;">${escapeHtml(label)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${value}</td></tr>`,
    )
    .join('');
  return `<p>A bid was won.</p><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">${tableRows}</table>`;
}

export async function notifyFounderOnBidOutcome(
  args: NotifyFounderOnBidOutcomeArgs,
): Promise<void> {
  const _tagline = 'notify-founder-on-bid-outcome';

  let adminEmail: string | null = null;
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { email: true },
    });
    adminEmail = admin?.email ?? null;
  } catch {
    adminEmail = null;
  }
  if (!adminEmail) {
    return;
  }

  const apiKey = env.POLSIA_API_KEY;
  if (!apiKey) {
    return;
  }

  const subject = `Bid won: ${clampTitle(args.title, args.bidDraftId)} (${sourceBadge(args.source)})`;
  const body = buildPlainBody(args);
  const html = buildHtmlBody(args);

  try {
    const result = await sendEmail({ to: adminEmail, subject, body, html });
    if (result.status !== null && result.status >= 400) {
    }
  } catch (e) {
    const _message = e instanceof Error ? e.message : String(e);
  }
}
