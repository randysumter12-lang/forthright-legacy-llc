// @polsia:user-owned — checkout button.
// POSTs `{ tier }` to /api/billing/subscription, receives the hosted Stripe
// Checkout URL and redirects the browser there. Invalid tier / no session →
// bounces the user to /login (with returnTo so they land back on /pricing).
//
// The button is the entry-point that ACTUALLY gates the funnel — anonymous
// /pricing visitors who ignore the table and hit Subscribe first hit the
// sign-in wall, not an opaque 401 while they're already on the page.

'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { CheckoutResponse, type Tier } from '@/lib/contracts/subscription';
import { cn } from '@/lib/utils';

export interface CheckoutButtonProps extends Omit<ButtonProps, 'onClick' | 'asChild'> {
  tier: Tier;
  label?: string;
  // Optional override of the price line shown on the button (e.g. for "Choose
  // plan" CTAs that don't need to repeat "$X/mo").
  priceLabel?: string;
  // When true, render a square CTA without the price badge.
  compact?: boolean;
}

type Status = 'idle' | 'loading' | 'redirecting';

const TIER_TO_RETURN = (tier: Tier) => `/pricing?tier=${tier}`;

export function CheckoutButton({
  tier,
  label,
  priceLabel,
  compact = false,
  className,
  disabled,
  children,
  ...buttonProps
}: CheckoutButtonProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = React.useCallback(async () => {
    setError(null);
    setStatus('loading');
    try {
      const res = await apiFetch('/api/billing/subscription', {
        method: 'POST',
        body: JSON.stringify({ tier }),
        schema: CheckoutResponse,
      });
      setStatus('redirecting');
      window.location.assign(res.url);
    } catch (err) {
      // 401 → bounce to /login with returnTo so the user returns to /pricing
      // and clicks Subscribe again.
      if (err instanceof Error) {
        const cause = (err as { cause?: unknown }).cause as
          | { status?: number; error?: string }
          | undefined;
        const status = cause?.status ?? 0;
        const message = cause?.error ?? '';
        if (status === 401 || message === 'unauthorized') {
          router.replace(`/login?returnTo=${encodeURIComponent(TIER_TO_RETURN(tier))}`);
          setStatus('idle');
          return;
        }
        if (status === 402) {
          router.push('/dashboard/billing?reason=upgrade_required');
          setStatus('idle');
          return;
        }
        if (status === 503) {
          setError('Payments are not yet enabled for this environment. Please contact support.');
          setStatus('idle');
          return;
        }
        setError(
          "We couldn't start checkout right now. Please try again in a moment — if it keeps happening, contact rigel-solutions@polsia.io.",
        );
      } else {
        setError(
          "We couldn't start checkout right now. Please try again in a moment — if it keeps happening, contact rigel-solutions@polsia.io.",
        );
      }
      setStatus('idle');
    }
  }, [tier, router]);

  const ctaLabel =
    label ??
    (compact
      ? 'Subscribe'
      : `Subscribe to ${tier === 'ELITE' ? 'Elite' : tier === 'PROFESSIONAL' ? 'Professional' : 'Starter'}`);

  return (
    <div className="flex flex-col gap-2">
      <Button
        {...buttonProps}
        type="button"
        onClick={handleClick}
        disabled={disabled || status !== 'idle'}
        className={cn('w-full', className)}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Starting checkout…</span>
          </>
        ) : status === 'redirecting' ? (
          <span>Redirecting to Stripe…</span>
        ) : (
          <>
            <span>{ctaLabel}</span>
            {priceLabel ? <span className="ml-2 text-small opacity-80">{priceLabel}</span> : null}
          </>
        )}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
