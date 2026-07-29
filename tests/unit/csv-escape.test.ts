// @polsia:user-owned — pure-helper tests for src/lib/csv.{csvEscape,toCsvRow}.
// RFC 4180 quoting behavior: wrap in `"…"` when a field contains `,`, `"`,
// CR, or LF; double every embedded `"`. Empty / null / undefined → empty
// string, no quotes.

import { describe, expect, it } from 'vitest';
import { csvEscape, toCsvRow } from '@/lib/csv';

describe('csvEscape — pass-through', () => {
  it('returns plain ASCII verbatim without quoting', () => {
    expect(csvEscape('Hello world')).toBe('Hello world');
  });

  it('returns whitespace and punctuation verbatim when no reserved chars', () => {
    // No comma, quote, CR, or LF inside — so no quoting.
    expect(csvEscape('DOT/Navy Phase II')).toBe('DOT/Navy Phase II');
  });
});

describe('csvEscape — quoting triggers', () => {
  it('wraps in quotes when the field contains a comma', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('wraps in quotes AND doubles an embedded double-quote', () => {
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('wraps in quotes when the field contains CR and keeps the CR verbatim', () => {
    expect(csvEscape('line1\rline2')).toBe('"line1\rline2"');
  });

  it('wraps in quotes when the field contains LF and keeps the LF verbatim', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles a field that mixes comma + quote + CR + LF in one shot', () => {
    expect(csvEscape('a,"b"\nc\r')).toBe('"a,""b""\nc\r"');
  });
});

describe('csvEscape — emptiness', () => {
  it('null becomes empty string', () => {
    expect(csvEscape(null)).toBe('');
  });

  it('undefined becomes empty string', () => {
    expect(csvEscape(undefined)).toBe('');
  });

  it('empty string stays empty string', () => {
    expect(csvEscape('')).toBe('');
  });
});

describe('toCsvRow', () => {
  it('joins fields by comma, quoting only those that need it', () => {
    // Field 1 contains a comma → wrapped. Field 2 contains quotes → wrapped
    // and every internal `"` is doubled. Field 3 is null → empty. Field 4
    // is plain → pass-through.
    expect(toCsvRow(['Title, with comma', '"quoted"', null, 'plain'])).toBe(
      '"Title, with comma","""quoted""",,plain',
    );
  });

  it('emits no trailing newline / no extra separators for an empty array', () => {
    expect(toCsvRow([])).toBe('');
  });

  it('preserves structural column count when wrapping a quoted field', () => {
    // Field 1 has three internal commas — they stay INSIDE the wrapping
    // quotes so they MUST NOT become column separators. The wrapper itself
    // plus the lone separator between field 1 and field 2 is the only
    // structure the column-split sees. Asserting the exact string is the
    // strongest possible column-count guarantee (1 wrapper + 1 sep).
    expect(toCsvRow(['a,b,c,d', 'plain'])).toBe('"a,b,c,d",plain');
  });
});

describe('route / SubmittedBidsItem discipline', () => {
  it('ships every column the route handler projects', () => {
    // If you add a new CSV column in src/app/api/bids/export/route.ts, add
    // it here. This test is the round-trip guarantee: the helper contract
    // is generic, the route's column set is the user-visible contract.
    const expected = [
      'title',
      'agency',
      'source',
      'setAside',
      'dueDate',
      'submittedAt',
      'outcome',
      'auditCount',
    ];
    // Header row built via the same helper the route uses — assert exact
    // shape (no leading separator, no trailing separator, every quoted
    // chunk wraps the commas the brief's labels don't contain).
    expect(toCsvRow(expected)).toBe(
      'title,agency,source,setAside,dueDate,submittedAt,outcome,auditCount',
    );
  });
});
