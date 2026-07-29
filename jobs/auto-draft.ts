// Invoked by the [[crons]] block in polsia.toml; do NOT move under src/ — the
// cron runner expects repo-root job paths. Identical posture to
// jobs/sam-scrape.ts: the orchestrator owns the Audit row + DB round-trip;
// cron exit code carries the success/failure signal back to the scheduler.
import { runAutoDraft } from '../src/lib/business/auto-draft';

async function main(): Promise<void> {
  const run = await runAutoDraft({ trigger: 'cron' });
  process.exit(run.status === 'OK' || run.status === 'SKIPPED' ? 0 : 1);
}

main().catch((_err: unknown) => {
  process.exit(1);
});
