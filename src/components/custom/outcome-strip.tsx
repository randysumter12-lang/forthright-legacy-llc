// @polsia:user-owned — outcome strip for the landing page. Static marketing
// framing of the platform's target throughput. Pure presentational server
// component — no `'use client'`, no fetch, no server-only imports.

interface Stat {
  figure: string;
  caption: string;
}

const STATS: Stat[] = [
  {
    figure: '8 wins / month',
    caption: 'Target pipeline throughput at the Professional tier.',
  },
  {
    figure: '≈ $62,500 gross / month',
    caption: 'Modeled on the $7,812 mid-point of the $3,500–$10,000 simplified-acquisition band.',
  },
  {
    figure: '≈ $750,000 / year',
    caption: 'Projected annual run-rate once the daily autonomous refresh loop is humming.',
  },
];

export function OutcomeStrip() {
  return (
    <section
      id="outcomes"
      aria-labelledby="outcomes-title"
      className="relative overflow-hidden border-y border-border bg-brand-900 text-primary-foreground"
    >
      {/* Subtle animated scanline */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="scanline" />
      </div>

      <div className="container-page relative">
        <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-12 items-center">
          <div className="flex flex-col gap-3">
            <span className="text-caption font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Projected Run-Rate
            </span>
            <h2
              id="outcomes-title"
              className="font-display text-3xl xl:text-h2 font-bold tracking-tight text-balance"
            >
              Stop hand-picking bids. Let the scraps send bids.
            </h2>
            <p className="text-body text-[var(--accent)]/90 max-w-md">
              Conservative numbers — the simplified-acquisition band is $3,500–$10,000, and the
              reconstructed win-rate comes from averaging recent historical outcomes on matched
              set-aside-eligible micro-purchases.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATS.map(({ figure, caption }) => (
              <div
                key={figure}
                className="flex flex-col gap-2 rounded-md border border-[var(--accent)]/30 bg-brand-800/60 px-5 py-6 shadow-brand"
              >
                <span className="font-display text-3xl xl:text-h3 font-bold leading-none text-[var(--accent)]">
                  {figure}
                </span>
                <span className="text-small text-[var(--accent)]/80 leading-relaxed">
                  {caption}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-caption text-[var(--accent)]/70">
          Modeled at the recommended Professional tier ($495/mo); actual outcomes vary with category
          fit, set-aside eligibility windows, and federal market posture.
        </p>
      </div>
    </section>
  );
}
