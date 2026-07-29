// @polsia:user-owned — your Next.js customizations, merged into next.config.ts by the
// framework. Edit freely (no slot markers). next.config.ts stays framework-owned: don't
// put security headers / CSP / a full `images` block here.
import type { NextConfig } from 'next';
import type { CspExtraSources } from '@/lib/csp';
import type { AppCapabilities } from '@/lib/permissions-policy';

type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

/** Remote hosts you load <Image> from. e.g. { protocol: 'https', hostname: 'images.unsplash.com' } */
export const userRemotePatterns: RemotePatterns = [];

/** Package-level Next options (transpilePackages, experimental.optimizePackageImports, …). */
export const userNextConfig: NextConfig = {};

/**
 * Per-app CSP origin allow-lists. Default empty = same-origin + NEXT_PUBLIC_API_URL only
 * (frame/connect/media/font/img directives). The strict script-src rampart is NEVER
 * touched from here. Wildcards and execution-escape tokens are dropped — see csp.ts.
 * Add an origin to embed Stripe, load YouTube/reCAPTCHA/maps, talk to another API, etc.
 *
 *   export const cspExtraSources: CspExtraSources = {
 *     connectSrc: ['https://api.stripe.com'],
 *     frameSrc: ['https://js.stripe.com'],
 *     imgSrc: ['https://*.cloudfront.net'],
 *   };
 */
export const cspExtraSources: CspExtraSources = {
  // Stripe Checkout is hosted at checkout.stripe.com (the iframe) and the SDK
  // loads from js.stripe.com; the checkout API and customer-portal redirect hit
  // api.stripe.com / billing.stripe.com. The strict script-src rampart is
  // untouched — only these resource directives are widened.
  frameSrc: ['https://js.stripe.com', 'https://checkout.stripe.com', 'https://billing.stripe.com'],
  connectSrc: ['https://api.stripe.com', 'https://billing.stripe.com'],
};

/**
 * Per-app browser feature opt-ins for the Permissions-Policy header. Every feature
 * defaults to OFF (empty allow-list ⇒ disabled for ALL origins). Flipping a key to
 * true emits `<feature>=(self)` so THIS origin may request it; the browser's native
 * permission prompt remains the real gate. browsing-topics is not exposed by this seam.
 */
export const appCapabilities: AppCapabilities = {};

export type ConfigPlugin = (config: NextConfig) => NextConfig;

/**
 * Next plugins that must WRAP the whole config (next-intl, Sentry, MDX,
 * bundle-analyzer). Each entry is a `(config) => config` wrapper — pre-bind
 * options. next.config.ts applies these and re-asserts the security headers
 * afterward, so a plugin can extend the build but never drop the day-1 posture.
 * For i18n, install the `i18n` module and add its plugin here per its AGENT.md.
 *
 *   export const userConfigPlugins: ConfigPlugin[] = [
 *     createNextIntlPlugin('./src/i18n/request.ts'),
 *     (config) => withSentryConfig(config, { silent: true }),
 *   ];
 */
export const userConfigPlugins: ConfigPlugin[] = [];
