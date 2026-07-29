// @polsia:user-owned — shared urgency badge that pairs with the
// `src/lib/business/sam-deadline` helper. Reused by the home tile, the
// `/sam` feed, and the `/sam/[id]` detail page so deadlines communicate at a
// glance: destructive red for OVERDUE, amber for IMMINENT (<24h), brand
// navy for THIS_WEEK (<3d) / SOON (<7d), muted for OK and UNKNOWN.
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  DEADLINE_URGENCY_BADGE,
  DEADLINE_URGENCY_LABEL,
  type DeadlineUrgency,
  deadlineUrgency,
} from '@/lib/business/sam-deadline';

export interface DeadlineUrgencyBadgeProps {
  dueDate: string | null | undefined;
  label?: string;
  now?: Date;
  className?: string;
}

export function DeadlineUrgencyBadge({
  dueDate,
  label,
  now,
  className,
}: DeadlineUrgencyBadgeProps) {
  const bucket: DeadlineUrgency = deadlineUrgency(dueDate, now);
  const spec = DEADLINE_URGENCY_BADGE[bucket];
  const composed: BadgeProps = {
    variant: spec.variant,
    className: [spec.className, className].filter(Boolean).join(' ') || undefined,
  };
  return <Badge {...composed}>{label ?? DEADLINE_URGENCY_LABEL[bucket]}</Badge>;
}
