// Invoked by the [[crons]] block in polsia.toml; do NOT move under src/ — the
// cron runner expects repo-root job paths. `tsx` is added under the cron's
// `dependencies` so this file can run TS directly in the fresh-checkout runner.
import { runSamScrape } from '../src/lib/business/sam-scraper';

// Relative imports (not `@/...`) so this script runs under tsx in the cron
// runner without depending on tsconfig path resolution. env() is read inside
// runSamScrape() — DATABASE_URL must be set in the scheduler's env.
// `tsx` is installed by the [[crons]].dependencies block in polsia.toml.

async function main(): Promise<void> {
  const _startedAt = new Date().toISOString();
  const run = await runSamScrape({ trigger: 'cron' });
  const _finishedAt = new Date().toISOString();
  process.exit(run.status === 'OK' || run.status === 'RATE_LIMITED' ? 0 : 1);
}

main().catch((_err: unknown) => {
  process.exit(1);
});
