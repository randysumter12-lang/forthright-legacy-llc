// @polsia:user-owned — unit tests for the pure deadline-urgency helper.
// Mirrors the `tests/unit/sam/set-aside.test.ts` grammar: fake-timer + frozen
// NOW + boundary sweep. The module must remain jsdom-clean and free of any
// `server-only` / `@/lib/db` chain so the three SAM client islands can
// import it. These tests guard that boundary at module-load time.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEADLINE_URGENCY_BADGE,
  DEADLINE_URGENCY_LABEL,
  DEADLINE_URGENCY_ORDER,
  deadlineUrgency,
  deadlineUrgencyDetail,
  sortByUrgency,
} from '../../src/lib/business/sam-deadline';

const FROZEN_NOW = new Date('2026-07-20T17:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('module shape', () => {
  it('imports cleanly under jsdom (no server-only chain at module load)', () => {
    expect(typeof deadlineUrgency).toBe('function');
    expect(typeof deadlineUrgencyDetail).toBe('function');
    expect(typeof sortByUrgency).toBe('function');
    expect(Object.keys(DEADLINE_URGENCY_ORDER)).toEqual([
      'OVERDUE',
      'IMMINENT',
      'THIS_WEEK',
      'SOON',
      'OK',
      'UNKNOWN',
    ]);
  });

  it('exposes one badge spec per bucket with destructive reserved for OVERDUE', () => {
    expect(DEADLINE_URGENCY_BADGE.OVERDUE.variant).toBe('destructive');
    expect(DEADLINE_URGENCY_ORDER.OVERDUE).toBe(0);
    expect(DEADLINE_URGENCY_ORDER.IMMINENT).toBe(1);
    expect(DEADLINE_URGENCY_ORDER.THIS_WEEK).toBe(2);
    expect(DEADLINE_URGENCY_ORDER.SOON).toBe(3);
    expect(DEADLINE_URGENCY_ORDER.OK).toBe(4);
    expect(DEADLINE_URGENCY_ORDER.UNKNOWN).toBe(5);
    expect(DEADLINE_URGENCY_LABEL.OVERDUE).toBe('Overdue');
    expect(DEADLINE_URGENCY_LABEL.UNKNOWN).toBe('No deadline');
  });
});

describe('boundary cases', () => {
  it.each([
    [null, 'UNKNOWN'],
    [undefined, 'UNKNOWN'],
    ['not-a-date', 'UNKNOWN'],
    ['', 'UNKNOWN'],
  ])('null / undefined / invalid string (%s) => UNKNOWN', (input, expected) => {
    expect(deadlineUrgency(input, FROZEN_NOW)).toBe(expected);
  });

  it('deltaMs = 0 (deadline == now) => OVERDUE (strict ≤ boundary)', () => {
    expect(deadlineUrgency(FROZEN_NOW, FROZEN_NOW)).toBe('OVERDUE');
  });

  it('deltaMs = -1ms (1ms past) => OVERDUE', () => {
    const past = new Date(FROZEN_NOW.getTime() - 1);
    expect(deadlineUrgency(past, FROZEN_NOW)).toBe('OVERDUE');
  });

  it('deltaMs = +1h => IMMINENT', () => {
    const future = new Date(FROZEN_NOW.getTime() + 60 * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('IMMINENT');
  });

  it('deltaMs = +23h59m (just under 24h) => IMMINENT', () => {
    const future = new Date(FROZEN_NOW.getTime() + (23 * 60 + 59) * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('IMMINENT');
  });

  it('deltaMs = +24h exactly => THIS_WEEK (regression guard vs prior <48h chip)', () => {
    const future = new Date(FROZEN_NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('THIS_WEEK');
  });

  it('deltaMs = +2d 23h 59m => THIS_WEEK', () => {
    const future = new Date(FROZEN_NOW.getTime() + (2 * 24 * 60 + 23 * 60 + 59) * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('THIS_WEEK');
  });

  it('deltaMs = +3d exactly => SOON', () => {
    const future = new Date(FROZEN_NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('SOON');
  });

  it('deltaMs = +6d 23h 59m => SOON', () => {
    const future = new Date(FROZEN_NOW.getTime() + (6 * 24 * 60 + 23 * 60 + 59) * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('SOON');
  });

  it('deltaMs = +7d exactly => OK (regression guard)', () => {
    const future = new Date(FROZEN_NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('OK');
  });

  it('deltaMs = +14d => OK', () => {
    const future = new Date(FROZEN_NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(deadlineUrgency(future, FROZEN_NOW)).toBe('OK');
  });
});

describe('determinism + purity', () => {
  it('identical inputs produce identical output across many calls', () => {
    const iso = new Date(FROZEN_NOW.getTime() + 5 * 60 * 60 * 1000).toISOString();
    const first = deadlineUrgency(iso, FROZEN_NOW);
    const last = deadlineUrgency(iso, FROZEN_NOW);
    expect(first).toBe(last);
    expect(first).toBe('IMMINENT');
  });

  it('does not mutate the provided `now` argument', () => {
    const now = new Date(FROZEN_NOW.getTime() + 10 * 60 * 60 * 1000);
    const snapshot = now.getTime();
    deadlineUrgency(FROZEN_NOW, now);
    expect(now.getTime()).toBe(snapshot);
  });

  it('accepts the same input as a Date and as an ISO string with identical results', () => {
    const iso = '2026-07-21T10:00:00.000Z';
    const date = new Date(iso);
    expect(deadlineUrgency(iso, FROZEN_NOW)).toBe(deadlineUrgency(date, FROZEN_NOW));
  });
});

describe('deadlineUrgencyDetail', () => {
  it('returns UNKNOWN with hoursUntil=null for missing/invalid input', () => {
    const result = deadlineUrgencyDetail(null, FROZEN_NOW);
    expect(result.bucket).toBe('UNKNOWN');
    expect(result.hoursUntil).toBeNull();
    expect(result.label).toBe('No deadline');
  });

  it('reports hoursUntil ≈ 1 with the bucket-derived label for the +1h case', () => {
    const future = new Date(FROZEN_NOW.getTime() + 60 * 60 * 1000);
    const result = deadlineUrgencyDetail(future, FROZEN_NOW);
    expect(result.bucket).toBe('IMMINENT');
    expect(result.hoursUntil).not.toBeNull();
    if (result.hoursUntil !== null) {
      expect(result.hoursUntil).toBeCloseTo(1, 5);
    }
    expect(result.label).toBe('Due in 1h');
  });

  it('reports a day-rounded label for the +4d case', () => {
    const future = new Date(FROZEN_NOW.getTime() + 4 * 24 * 60 * 60 * 1000);
    const result = deadlineUrgencyDetail(future, FROZEN_NOW);
    expect(result.bucket).toBe('SOON');
    expect(result.label).toBe('Due in 4d');
  });
});

describe('sortByUrgency', () => {
  it('overrides the API ordering so OVERDUE/IMMINENT rise to the top', () => {
    const items = [
      {
        id: 'a',
        dueDate: new Date(FROZEN_NOW.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { id: 'b', dueDate: new Date(FROZEN_NOW.getTime() - 1000).toISOString() },
      { id: 'c', dueDate: new Date(FROZEN_NOW.getTime() + 60 * 60 * 1000).toISOString() },
      { id: 'd', dueDate: null },
    ];
    const sorted = sortByUrgency(items, FROZEN_NOW);
    expect(sorted.map((item) => item.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('preserves the input order inside the same bucket (stable sort)', () => {
    const items = [
      { id: 'x1', dueDate: new Date(FROZEN_NOW.getTime() + 60 * 60 * 1000).toISOString() },
      { id: 'x2', dueDate: new Date(FROZEN_NOW.getTime() + 90 * 60 * 1000).toISOString() },
      { id: 'x3', dueDate: new Date(FROZEN_NOW.getTime() + 30 * 60 * 1000).toISOString() },
    ];
    const sorted = sortByUrgency(items, FROZEN_NOW);
    expect(sorted.map((item) => item.id)).toEqual(['x1', 'x2', 'x3']);
  });
});
