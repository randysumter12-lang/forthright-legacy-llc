// Invoked by the [[crons]] block in polsia.toml; do NOT move under src/ — the
// cron runner expects repo-root job paths. Identical posture to
// jobs/sam-scrape.ts: the orchestrator owns the Audit row + DB round-trip;
// cron exit code carries the success/failure signal back to the scheduler.
import { runUnisonScrape } from '../src/lib/business/unison-scraper';

async function main(): Promise<void> {
  const run = await runUnisonScrape({ trigger: 'cron' });
  process.exit(run.status === 'OK' || run.status === 'RATE_LIMITED' ? 0 : 1);
}

main().catch((_err: unknown) => {
  process.exit(1);
});
