// @polsia:user-owned — shared source discriminator chip used on the /sam
// detail page, /sam live feed, today's-bid queue, and /submitted-bids table.
// Same visual language in every context so the eye can scan for the rarer
// UNISON badge in a SAM-heavy list. `size='sm'` tightens the chip for use
// inside dense queue row layouts.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface SourceBadgeProps {
  source: 'SAM' | 'UNISON';
  size?: 'sm' | 'md';
  className?: string;
}

export function SourceBadge({ source, size = 'md', className }: SourceBadgeProps) {
  const isSmall = size === 'sm';
  if (source === 'UNISON') {
    return (
      <Badge
        variant="default"
        className={cn(
          'bg-accent text-accent-foreground font-semibold tracking-wide',
          isSmall && 'text-caption',
          className,
        )}
      >
        {isSmall ? 'UNISON' : 'Unison Global'}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold tracking-wide border-border text-muted-foreground',
        isSmall && 'text-caption',
        className,
      )}
    >
      {isSmall ? 'SAM' : 'SAM.gov'}
    </Badge>
  );
}
