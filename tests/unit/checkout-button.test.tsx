// @polsia:user-owned — CheckoutButton flow tests.
//
// The button is the only entry-point that takes an anonymous visitor into
// the Stripe checkout funnel: it POSTs `{ tier }` to /api/billing/subscription
// and redirects the browser to the hosted Stripe URL it receives back. The
// plan (§2.4) calls for three branches:
//
//   1. Successful POST → `window.location.assign` to the Stripe URL.
//   2. 401 (no session) → push to `/login?returnTo=/pricing?tier=...`.
//   3. 503 (payments not configured) → surface the soft-fail copy.
//
// Mocks are at the transport boundary (@/lib/api-client, next/navigation)
// — the framework-owned auth/stripe modules are untouched. We mount the
// component via React's own `createRoot` so we don't take on a dependency
// on `@testing-library/react`.

// React 19 requires IS_REACT_ACT_ENVIRONMENT before RenderDOM's act() is
// usable. Setting it on globalThis matches what @testing-library/react
// does internally and keeps the console silent under "current testing
// environment is not configured to support act(...)".
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
const replace = vi.fn();
const push = vi.fn();
const assignSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/',
}));

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { CheckoutButton } from '@/components/custom/pricing/checkout-button';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  apiFetchMock.mockReset();
  replace.mockReset();
  push.mockReset();
  assignSpy.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: assignSpy },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

function mount(tier: 'STARTER' | 'PROFESSIONAL' | 'ELITE') {
  act(() => {
    root.render(createElement(CheckoutButton, { tier }));
  });
}

async function flush() {
  // Two scheduler ticks are enough to resolve the awaited apiFetch + the
  // subsequent setStatus('redirecting') flush in ClickHandler.
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function namedButton(): HTMLButtonElement {
  const btn = container.querySelector('button');
  if (!btn) throw new Error('CheckoutButton did not render a <button>');
  return btn;
}

// Tiny poll helper — vitest 3.x doesn't export `waitFor`.
async function expectEventually(
  assertion: () => void,
  { timeoutMs = 1000, intervalMs = 10 } = {},
): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw lastError ?? new Error('expectEventually: timed out');
}

describe('CheckoutButton — success branch', () => {
  it('POSTs the tier and assigns window.location to the Stripe URL on success', async () => {
    apiFetchMock.mockResolvedValue({
      url: 'https://checkout.stripe.com/c/cs_test_valid_session',
      tier: 'PROFESSIONAL',
      amountUsd: 495,
    });
    mount('PROFESSIONAL');
    await flush();

    const btn = namedButton();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toMatch(/subscribe to professional/i);

    await act(async () => {
      btn.click();
    });
    await flush();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/billing/subscription',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tier: 'PROFESSIONAL' }),
      }),
    );
    await expectEventually(() =>
      expect(assignSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_test_valid_session'),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('CheckoutButton — auth bounce (401)', () => {
  for (const tier of ['STARTER', 'PROFESSIONAL', 'ELITE'] as const) {
    it(`redirects to /login with a tier-aware returnTo when the API returns 401 (${tier})`, async () => {
      apiFetchMock.mockRejectedValue(
        Object.assign(new Error('apiFetch failed'), {
          cause: { status: 401, error: 'unauthorized' },
        }),
      );
      mount(tier);
      await flush();

      const btn = namedButton();
      const expectLabel = new RegExp(
        `subscribe to ${tier === 'ELITE' ? 'Elite' : tier === 'PROFESSIONAL' ? 'Professional' : 'Starter'}`,
        'i',
      );
      expect(btn.textContent).toMatch(expectLabel);

      await act(async () => {
        btn.click();
      });
      await flush();

      await expectEventually(() =>
        expect(replace).toHaveBeenCalledWith(
          `/login?returnTo=${encodeURIComponent(`/pricing?tier=${tier}`)}`,
        ),
      );
      expect(push).not.toHaveBeenCalled();
      expect(assignSpy).not.toHaveBeenCalled();
    });
  }
});

describe('CheckoutButton — payments not enabled (503)', () => {
  it('surfaces a soft-fail copy without bouncing away from the page', async () => {
    apiFetchMock.mockRejectedValue(
      Object.assign(new Error('apiFetch failed'), {
        cause: { status: 503, error: 'payments_not_enabled' },
      }),
    );
    mount('ELITE');
    await flush();

    const btn = namedButton();
    await act(async () => {
      btn.click();
    });
    await flush();

    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    await expectEventually(() =>
      expect(container.textContent || '').toMatch(/payments are not yet enabled/i),
    );
  });
});
