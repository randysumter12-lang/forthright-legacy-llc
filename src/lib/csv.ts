// @polsia:user-owned — RFC 4180 CSV escape helpers for GET /api/bids/export
// (and any future export surface that wants CSV). Pure, deterministic, and
// free of any `fs` / `Date` / DB dependency so the same helpers can run in the
// route handler, in client islands, and in vitest without swapping modules.
//
// Quoting rule (RFC 4180):
//   - Empty / null / undefined → empty string, no quotes.
//   - Any value containing a comma, double-quote, CR, or LF is wrapped in
//     `"…"`, and every embedded `"` is doubled to `""`. Internal CR / LF are
//     preserved verbatim inside the quoted field (Excel and LibreOffice both
//     support this for multi-line cells).
//   - Every other value is passed through unchanged.

export type CsvValue = string | null | undefined;

export function csvEscape(value: CsvValue): string {
  if (value == null || value === '') return '';
  if (/[,"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: ReadonlyArray<CsvValue>): string {
  return values.map(csvEscape).join(',');
}
