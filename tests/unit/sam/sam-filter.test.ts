// @polsia:user-owned — unit tests for the pure set-aside chip filter helper
// used by the SAM feed island. Mirrors the `tests/unit/sam-deadline.test.ts`
// convention: no DB, no apiFetch, jsdom-friendly. Module must stay free of any
// `server-only` / `@/lib/db` / `@prisma/client` chain so the client island
// can import it. The tests guard that boundary at module-load time.

import { describe, expect, it } from 'vitest';
import {
  CHIP_TO_PREDICATE_LABELS,
  matchesSetAsideFilter,
  SET_ASIDE_CHIP_KEYS,
} from '../../../src/lib/business/sam-filter';

describe('module shape', () => {
  it('imports cleanly under jsdom (no server-only chain at module load)', () => {
    expect(typeof matchesSetAsideFilter).toBe('function');
    expect(Array.isArray(SET_ASIDE_CHIP_KEYS)).toBe(true);
    expect(typeof CHIP_TO_PREDICATE_LABELS).toBe('object');
  });

  it('exposes exactly the four founder-facing chips in a stable order', () => {
    expect(SET_ASIDE_CHIP_KEYS).toEqual(['WOSB', 'SDVOSB', 'VOSB', 'MBE']);
  });

  it('snapshot: locks the founder-narrative chip→strings map', () => {
    expect(CHIP_TO_PREDICATE_LABELS).toEqual({
      WOSB: ['WOSB'],
      SDVOSB: ['SDVOSBC', 'SDVOSB'],
      VOSB: ['SDVOSBC'],
      MBE: ['8A'],
    });
  });
});

describe('matchesSetAsideFilter', () => {
  const make = (setAside: string | null | undefined, isSetAside: boolean) => ({
    setAside,
    isSetAside,
  });

  it('returns true for every row when no chips are active (default state)', () => {
    const set = new Set<string>();
    expect(matchesSetAsideFilter(make('8A', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make('WOSB', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make(null, false), set)).toBe(true);
  });

  it('matches WOSB chip against a row carrying setAside="WOSB"', () => {
    const set = new Set(['WOSB']);
    expect(matchesSetAsideFilter(make('WOSB', true), set)).toBe(true);
  });

  it('rejects WOSB chip against a row carrying setAside="8A"', () => {
    const set = new Set(['WOSB']);
    expect(matchesSetAsideFilter(make('8A', true), set)).toBe(false);
  });

  it('SDVOSB chip matches both the normalized "SDVOSBC" and the raw "SDVOSB" form', () => {
    const set = new Set(['SDVOSB']);
    expect(matchesSetAsideFilter(make('SDVOSBC', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make('SDVOSB', true), set)).toBe(true);
  });

  it('VOSB chip falls back to the SDVOSBC bucket (no row carries raw VOSB)', () => {
    const set = new Set(['VOSB']);
    expect(matchesSetAsideFilter(make('SDVOSBC', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make('WOSB', true), set)).toBe(false);
  });

  it('MBE chip falls back to the 8A bucket (no row carries raw MBE)', () => {
    const set = new Set(['MBE']);
    expect(matchesSetAsideFilter(make('8A', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make('WOSB', true), set)).toBe(false);
  });

  it('multi-select union: WOSB + MBE matches both corresponding rows', () => {
    const set = new Set(['WOSB', 'MBE']);
    expect(matchesSetAsideFilter(make('WOSB', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make('8A', true), set)).toBe(true);
    expect(matchesSetAsideFilter(make('SDVOSBC', true), set)).toBe(false);
  });

  it('ignores rows without a set-aside flag regardless of the active chip set', () => {
    const set = new Set(['SDVOSB']);
    // isSetAside=false => not a set-aside row → never matches when narrowing
    expect(matchesSetAsideFilter(make('SDVOSBC', false), set)).toBe(false);
    expect(matchesSetAsideFilter(make('WOSB', false), set)).toBe(false);
  });

  it('does not match a flagged-but-null setAside string under a WOSB active set', () => {
    const set = new Set(['WOSB']);
    expect(matchesSetAsideFilter(make(null, true), set)).toBe(false);
    expect(matchesSetAsideFilter(make(undefined, true), set)).toBe(false);
    expect(matchesSetAsideFilter(make('', true), set)).toBe(false);
  });

  it('does not match set-aside EDWOSB / HUBZone / SBA rows under any founder chip', () => {
    const chips = ['WOSB', 'SDVOSB', 'VOSB', 'MBE'] as const;
    for (const chip of chips) {
      const set = new Set([chip]);
      expect(matchesSetAsideFilter(make('EDWOSB', true), set)).toBe(false);
      expect(matchesSetAsideFilter(make('HUBZone', true), set)).toBe(false);
      expect(matchesSetAsideFilter(make('SBA', true), set)).toBe(false);
    }
  });
});
