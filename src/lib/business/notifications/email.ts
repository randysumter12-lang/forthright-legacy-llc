// @polsia:user-owned — server-only email proxy helper. Shared between the
// bid-submission notifier and the morning digest cron. Pure HTML escaping +
// formatting helpers + a single typed `sendEmail()` that POSTs to the
// per-company `/api/proxy/email/send` endpoint with bearer auth. The
// `sendFounderEmail()` convenience wrapper swallows network rejections so
// callers (which already do their own env pre-check + log-on-error) never
// see a thrown error from the email path.
//
// Failure semantics:
//  - HTTP 2xx       → { status, error: null }
//  - HTTP non-2xx   → { status, error: <parsed body or text> }
//  - fetch throws   → { status: null, error: <message> }
// Callers can branch on `status` (>=400 / null) and log + continue; the
// wrapper itself never throws.
//
// No `server-only` marker here — the cron entrypoint (`jobs/daily-digest.ts`)
// AND the API route handler both reach into this module. Adding the marker
// would brick the cron runner, which is plain `tsx` and has no Next runtime.

import { env } from '@/lib/env';
import { deriveProxyBase } from '@/lib/host-proxy';

export interface SendEmailArgs {
  to: string;
  subject: string;
  body: string;
  html: string;
}

/**
 * `status === null` is reserved for the swallow wrapper (network rejected);
 * the raw `sendEmail()` always returns a finite status code.
 */
export interface SendEmailResult {
  status: number | null;
  error: string | null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatUtc(date: Date): string {
  const iso = date.toISOString();
  return iso.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function clampTitle(title: string | null | undefined, fallback: string): string {
  const raw = (title ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (raw.length === 0) return fallback;
  if (raw.length <= 120) return raw;
  return `${raw.slice(0, 117)}...`;
}

export function sourceBadge(source: 'SAM' | 'UNISON'): string {
  return source === 'UNISON' ? 'Unison Global' : 'SAM.gov';
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const baseUrl = (env.POLSIA_API_BASE_URL ?? deriveProxyBase('__default__')).replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/api/proxy/email/send`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.POLSIA_API_KEY}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      to: args.to,
      subject: args.subject,
      body: args.body,
      html: args.html,
    }),
    cache: 'no-store',
  });
  let parsedError: string | null = null;
  if (!res.ok) {
    try {
      const text = await res.text();
      if (text.length > 0) {
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && 'error' in parsed) {
            parsedError = String((parsed as { error: unknown }).error);
          } else {
            parsedError = text.slice(0, 200);
          }
        } catch {
          parsedError = text.slice(0, 200);
        }
      }
    } catch {
      parsedError = null;
    }
  }
  return { status: res.status, error: parsedError };
}

export async function sendFounderEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  try {
    return await sendEmail(args);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: null, error: message };
  }
}
