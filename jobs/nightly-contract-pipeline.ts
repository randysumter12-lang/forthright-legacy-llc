// Invoked by the [[crons]] block in polsia.toml. Sequentially runs the
// scrape → auto-draft pipeline so a single deployment trigger covers both
// data ingest AND bid-draft generation. Each step is fail-open relative to
// the next: a SAM.gov 5xx / RATE_LIMIT becomes a non-zero SamScrapeRun row
// but does NOT block Unison, and either scraper failing does NOT block the
// auto-draft step over whatever rows DID land.
//
// Audit visibility lives in the database (SamScrapeRun, AutoDraftRun rows
// written by each orchestrator). Cron entries do not log to stdout — the
// strict noConsole lint gate and the same posture as jobs/sam-scrape.ts
// require the runner to read the Audit row for status.
//
// Exit policy:
//  - all OK/RATE_LIMIT/SKIPPED  → 0
//  - any hard ERROR             → 1
import { runAutoDraft, serializeAutoDraftForContract } from '../src/lib/business/auto-draft';
import { runSamScrape } from '../src/lib/business/sam-scraper';
import { runUnisonScrape } from '../src/lib/business/unison-scraper';

interface StepSummary {
  name: string;
  status: string;
  errorMessage: string | null;
}

async function runWithSummary(
  name: string,
  step: () => Promise<{ status: string; errorMessage?: string | null }>,
): Promise<StepSummary> {
  try {
    const result = await step();
    return { name, status: result.status, errorMessage: result.errorMessage ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { name, status: 'ERROR', errorMessage: message };
  }
}

async function main(): Promise<void> {
  const samSummary = await runWithSummary('sam', () => runSamScrape({ trigger: 'cron' }));
  const unisonSummary = await runWithSummary('unison', () => runUnisonScrape({ trigger: 'cron' }));
  const autoDraftRecord = await runAutoDraft({ trigger: 'cron' });
  const autoDraftSummary = serializeAutoDraftForContract(autoDraftRecord);

  const anyHardError =
    samSummary.status === 'ERROR' ||
    unisonSummary.status === 'ERROR' ||
    autoDraftSummary.status === 'ERROR';
  process.exit(anyHardError ? 1 : 0);
}

main().catch((_err: unknown) => {
  process.exit(1);
});
