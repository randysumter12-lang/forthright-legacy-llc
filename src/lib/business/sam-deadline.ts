// @polsia:user-owned — pure deadline-urgency helper for SAM.gov + Unison
// Global opportunities. Lives under `src/lib/business/`, intentionally free
// of `server-only`, `@/lib/db`, `@/lib/env`, `next/headers`, and `@/lib/auth`
// so the three `'use client'` SAM islands can import it without dragging in
// Node-only modules. Mirrors the `set-aside.ts` / `qualify.ts` precedent.

export type DeadlineUrgency = 'OVERDUE' | 'IMMINENT' | 'THIS_WEEK' | 'SOON' | 'OK' | 'UNKNOWN';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const DEADLINE_URGENCY_ORDER: Record<DeadlineUrgency, number> = {
  OVERDUE: 0,
  IMMINENT: 1,
  THIS_WEEK: 2,
  SOON: 3,
  OK: 4,
  UNKNOWN: 5,
};

export const DEADLINE_URGENCY_LABEL: Record<DeadlineUrgency, string> = {
  OVERDUE: 'Overdue',
  IMMINENT: 'Due within 24h',
  THIS_WEEK: 'Due within 3 days',
  SOON: 'Due within 7 days',
  OK: 'On track',
  UNKNOWN: 'No deadline',
};

export interface UrgencyBadgeSpec {
  variant: 'destructive' | 'outline';
  className: string | null;
}

export const DEADLINE_URGENCY_BADGE: Record<DeadlineUrgency, UrgencyBadgeSpec> = {
  OVERDUE: { variant: 'destructive', className: null },
  IMMINENT: {
    variant: 'outline',
    className: 'border-amber-400 bg-amber-100/40 text-amber-900 font-semibold',
  },
  THIS_WEEK: {
    variant: 'outline',
    className: 'border-brand text-brand-700 bg-brand-50 font-semibold',
  },
  SOON: { variant: 'outline', className: 'border-brand text-brand-700 font-semibold' },
  OK: { variant: 'outline', className: 'border-border text-muted-foreground' },
  UNKNOWN: { variant: 'outline', className: 'border-border text-muted-foreground' },
};

function toDate(deadline: Date | string | null | undefined): Date | null {
  if (deadline == null) return null;
  if (deadline instanceof Date) {
    return Number.isNaN(deadline.getTime()) ? null : deadline;
  }
  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDetailLabel(bucket: DeadlineUrgency, hoursUntil: number): string {
  if (bucket === 'OVERDUE') return 'Overdue';
  if (bucket === 'IMMINENT') return `Due in ${Math.max(1, Math.floor(hoursUntil))}h`;
  if (bucket === 'THIS_WEEK') return `Due in ${Math.max(1, Math.floor(hoursUntil / 24))}d`;
  if (bucket === 'SOON') return `Due in ${Math.floor(hoursUntil / 24)}d`;
  if (bucket === 'OK') return 'On track';
  return 'No deadline';
}

export function deadlineUrgency(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): DeadlineUrgency {
  const due = toDate(deadline);
  if (!due) return 'UNKNOWN';
  const deltaMs = due.getTime() - now.getTime();
  if (deltaMs <= 0) return 'OVERDUE';
  if (deltaMs < 24 * HOUR_MS) return 'IMMINENT';
  if (deltaMs < 3 * DAY_MS) return 'THIS_WEEK';
  if (deltaMs < 7 * DAY_MS) return 'SOON';
  return 'OK';
}

export interface DeadlineUrgencyDetail {
  bucket: DeadlineUrgency;
  label: string;
  hoursUntil: number | null;
}

export function deadlineUrgencyDetail(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): DeadlineUrgencyDetail {
  const due = toDate(deadline);
  if (!due) return { bucket: 'UNKNOWN', label: 'No deadline', hoursUntil: null };
  const hoursUntil = (due.getTime() - now.getTime()) / HOUR_MS;
  const bucket = deadlineUrgency(due, now);
  return { bucket, label: formatDetailLabel(bucket, hoursUntil), hoursUntil };
}

export function sortByUrgency<T extends { dueDate?: string | null | undefined }>(
  items: readonly T[],
  now: Date = new Date(),
): T[] {
  return items
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      bucket: deadlineUrgency(item.dueDate, now),
    }))
    .sort((a, b) => {
      const bucketDiff = DEADLINE_URGENCY_ORDER[a.bucket] - DEADLINE_URGENCY_ORDER[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ item }) => item);
}
