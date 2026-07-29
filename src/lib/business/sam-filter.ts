// @polsia:user-owned — pure helpers for client-side set-aside filter chips on
// /sam. Maps the founder-facing chip labels (VOSB, SDVOSB, WOSB, MBE) to the
// strings actually stored on SamOpportunity.setAside (SDVOSBC, 8A, WOSB,
// SDVOSB). Pure: client-importable, no server-only imports, no Prisma, so the
// SAM client island can import it without leaking the data plane into the
// render layer. The VOSB / MBE buckets aren't normalized on incoming rows
// today — they fall back to SDVOSBC / 8A respectively, matching the founder
// narrative in the marketing copy.
export type SetAsideFilterKey = 'ALL' | 'WOSB' | 'SDVOSB' | 'VOSB' | 'MBE';

export const SET_ASIDE_CHIP_KEYS: readonly Exclude<SetAsideFilterKey, 'ALL'>[] = [
  'WOSB',
  'SDVOSB',
  'VOSB',
  'MBE',
] as const;

export const CHIP_TO_PREDICATE_LABELS: Record<
  Exclude<SetAsideFilterKey, 'ALL'>,
  readonly string[]
> = {
  WOSB: ['WOSB'],
  SDVOSB: ['SDVOSBC', 'SDVOSB'],
  VOSB: ['SDVOSBC'],
  MBE: ['8A'],
};

export interface SetAsideFilterable {
  setAside?: string | null;
  isSetAside: boolean;
}

export function matchesSetAsideFilter(
  op: SetAsideFilterable,
  activeChips: ReadonlySet<string>,
): boolean {
  if (activeChips.size === 0) return true;
  if (!op.isSetAside) return false;
  const value = (op.setAside ?? '').trim();
  if (!value) return false;
  for (const chip of activeChips) {
    const labels = CHIP_TO_PREDICATE_LABELS[chip as Exclude<SetAsideFilterKey, 'ALL'>];
    if (labels?.includes(value)) return true;
  }
  return false;
}
