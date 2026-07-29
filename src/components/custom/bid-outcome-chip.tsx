// @polsia:user-owned — shared outcome chip used by <SamDetail> header and
// <SubmittedBidsTable> column. Co-locating `outcomeChipClass(outcome)` +
// the <OutcomeChip> wrapper here keeps both surfaces in lockstep on color
// (WON = green, LOST = red, NO_RESPONSE = amber) and copy ("Won" / "Lost"
// / "No response") without two-buttons-edits divergence. Pure
// presentational — no `'use client'`, no apiFetch, no server-only imports.

import { Badge } from '@/components/ui/badge';
import type { BidOutcome } from '@/lib/contracts/bid-draft';

const CHIP_CLASS: Record<BidOutcome, string> = {
  WON: 'border-transparent bg-green-700 text-white font-semibold',
  LOST: 'border-transparent bg-red-600 text-white font-semibold',
  NO_RESPONSE: 'border-transparent bg-amber-500 text-white font-semibold',
};

const CHIP_LABEL: Record<BidOutcome, string> = {
  WON: 'Won',
  LOST: 'Lost',
  NO_RESPONSE: 'No response',
};

// outcomeChipClass — exported so list callers (e.g. <SubmittedBidsTable>)
// can drop the same Chip classname onto a raw Badge. Returns 'undefined'
// when outcome is null so the caller can render an empty cell.
export function outcomeChipClass(outcome: BidOutcome | null | undefined): string | undefined {
  if (outcome == null) return undefined;
  return CHIP_CLASS[outcome];
}

export function outcomeChipLabel(outcome: BidOutcome | null | undefined): string | undefined {
  if (outcome == null) return undefined;
  return CHIP_LABEL[outcome];
}

interface Props {
  outcome: BidOutcome | null | undefined;
  className?: string;
  title?: string;
}

export function OutcomeChip({ outcome, className, title }: Props) {
  const klass = outcomeChipClass(outcome);
  if (!klass) return null;
  return (
    <Badge variant="default" className={[klass, className].filter(Boolean).join(' ')} title={title}>
      {outcomeChipLabel(outcome)}
    </Badge>
  );
}
