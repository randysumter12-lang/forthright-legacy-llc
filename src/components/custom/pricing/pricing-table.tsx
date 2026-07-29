// @polsia:user-owned — 3-tier pricing table island.
//
// Loads /api/pricing (a static catalog) and renders one card per tier.
// Visual language: Midnight Navy + Brushed Silver (theme tokens do the work;
// no hardcoded colors), sharp `var(--radius)` edges (institutional/military),
// the Professional card is the highlighted "Most selected" band. CTAs are
// <CheckoutButton/> islands — clicking on a tier starts the Stripe flow.

'use client';

import { Check } from 'lucide-react';
import * as React from 'react';
import { CheckoutButton } from '@/components/custom/pricing/checkout-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { PricingList, type Tier as PricingTier } from '@/lib/contracts/subscription';
import { cn } from '@/lib/utils';

interface TierCardProps {
  tier: PricingTier;
  name: string;
  headline: string;
  description: string;
  amountUsd: number;
  interval: string;
  features: readonly string[];
  badge: string;
  highlighted: boolean;
  index: number;
  compact: boolean;
}

function TierCard({
  tier,
  name,
  headline,
  description,
  amountUsd,
  interval,
  features,
  badge,
  highlighted,
  index,
  compact,
}: TierCardProps) {
  return (
    <Card
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground shadow-brand transition-transform duration-200 ease-out-expo hover:-translate-y-0.5',
        highlighted ? 'border-brand-400/40 shadow-lg brushed-edge' : 'border-border/80 shadow-sm',
      )}
      data-tier-card={tier}
      data-tier-index={index}
    >
      {/* Highlighted "Most selected" indicator — a thin silver hairline */}
      {highlighted ? (
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--accent)]/60" aria-hidden />
      ) : null}
      <CardContent className={cn('flex h-full flex-col gap-5', compact ? 'p-6' : 'p-7')}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-h3 tracking-tight text-foreground">{name}</h3>
          {badge ? (
            <Badge variant={highlighted ? 'default' : 'secondary'} className="uppercase">
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="text-small text-muted-foreground">{headline}</p>
        {!compact && description ? (
          <p className="text-small text-muted-foreground leading-relaxed">{description}</p>
        ) : null}

        {/* Price */}
        <div className="flex items-baseline gap-2 border-b border-border/60 pb-5">
          <span className="font-display text-display leading-none text-foreground">
            <span className="text-2xl align-top text-muted-foreground">$</span>
            {amountUsd}
          </span>
          <span className="text-body text-muted-foreground">{interval}</span>
        </div>

        {/* Features */}
        <ul className="grid gap-2.5 text-sm" aria-label={`${name} features`}>
          {features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <Check
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  highlighted ? 'text-[var(--accent)]' : 'text-brand-500',
                )}
              />
              <span className="text-foreground/90">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-auto pt-2">
          <CheckoutButton
            tier={tier}
            size="lg"
            variant={highlighted ? 'default' : 'outline'}
            priceLabel={`$${amountUsd}/mo`}
            compact={compact}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export interface PricingTableProps {
  /** Initial server-rendered tiers (passed from the pricing page in case the
   *  client fetch fails — SSR-safe fallback). */
  initialTiers?: ReadonlyArray<{
    tier: PricingTier;
    name: string;
    headline: string;
    description: string;
    amountUsd: number;
    interval: string;
    features: readonly string[];
    badge: string;
  }>;
  /** Compact band — hides the marketing description paragraph and tightens
   *  internal padding. Used on the in-page pricing band so the cards fit
   *  cleanly between the hero and outcome strip. */
  compact?: boolean;
}

export function PricingTable({ initialTiers, compact = false }: PricingTableProps) {
  const [tiers, setTiers] = React.useState(initialTiers ?? []);
  const [loading, setLoading] = React.useState(!initialTiers);

  React.useEffect(() => {
    if (initialTiers && initialTiers.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await apiFetch('/api/pricing', { schema: PricingList });
        if (cancelled) return;
        setTiers(payload.tiers);
      } catch {
        if (cancelled) return;
        setTiers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialTiers]);

  if (loading) {
    return (
      <div
        className={cn(
          'grid items-stretch gap-6 md:grid-cols-3',
          compact && 'overflow-x-auto sm:grid-cols-3',
        )}
        aria-busy="true"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse rounded-md border border-border/60 bg-card/60',
              compact ? 'h-[360px]' : 'h-[440px]',
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid items-stretch gap-6 md:grid-cols-3',
        compact && 'overflow-x-auto sm:grid-cols-3',
      )}
    >
      {tiers.map((tier, i) => (
        <TierCard
          key={tier.tier}
          tier={tier.tier}
          name={tier.name}
          headline={tier.headline}
          description={tier.description}
          amountUsd={tier.amountUsd}
          interval={tier.interval}
          features={tier.features}
          badge={tier.badge}
          highlighted={tier.tier === 'PROFESSIONAL'}
          index={i}
          compact={compact}
        />
      ))}
    </div>
  );
}
