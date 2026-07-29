// @polsia:user-owned — pure runtime proxy-base resolution.
//
// Returns the Polsia PLATFORM payment proxy root — the base host that serves
// /api/v2/app-payments/checkout-session — regardless of which of our public
// domains (apex, www., legacy .io / .app stage aliases) the buyer arrived on.
// The proxy is tenant-scoped to the company at the platform layer, so every
// incoming host collapses to the same base. It is INTENTIONALLY NOT the
// customer's own domain (rigelcontracts.co) — routing checkout through the
// customer apex is a self-loop that returns 404/HTML and breaks checkout.
//
// It is also intentionally NOT read from env.POLSIA_API_BASE_URL: that value
// is dashboard-managed on this tenant and is currently pinned to the customer
// apex/stage alias, not the platform root, so trusting it silently reintroduces
// the same self-loop bug. The platform root is compiled in here.
//
// Edge-pure: no I/O, no env reads. Directly unit-testable.
//
// PLATFORM_PROXY_BASE = https://polsia.com — verified via a real HTTP probe
// (POST /api/v2/app-payments/checkout-session with a bogus bearer): polsia.com
// returned the Polsia platform JSON error envelope
// {"error":{"message":"Invalid API key format. API keys should start with
// \"company_\"", ...}}, while polsia.io / polsia.io do not resolve in public
// DNS. That JSON shape is what confirms polsia.com is the platform payment
// proxy root, not a customer-app apex.
//
// `incomingHost` is retained in the signature for future per-tenant routing;
// for now every input maps to the same PLATFORM_PROXY_BASE.

const PLATFORM_PROXY_BASE = 'https://polsia.com';

export function deriveProxyBase(_incomingHost: string): string {
  return PLATFORM_PROXY_BASE;
}
