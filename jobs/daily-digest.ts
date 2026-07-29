// Invoked by the [[crons]] block in polsia.toml. Single-shot morning digest:
// pulls the same dashboard numbers the live widget shows, picks the top 5
// qualifying rows, and emails the founder a plain-text + HTML body via the
// platform email proxy. Fired at 13:30 UTC ≈ 09:30 America/Eastern, ≥30 min
// after `nightly-contract-pipeline` so the digest reads the just-finished
// scrape + auto-draft pass.
//
// Cron posture (mirrors nightly-contract-pipeline.ts):
//   - No `console.*` (strict noConsole lint gate).
//   - TSX entry — `tsx` is declared in the [[crons]] `dependencies` block and
//     loaded directly by `npx tsx jobs/daily-digest.ts`.
//   - Relative imports only — the cron runner has no `@/` alias resolution.
//   - `prisma.$disconnect()` at end so the runner doesn't leak the connection
//     across invocations.
//   - Exit codes: helper reached + status ∈ {OK, EMPTY, SKIPPED} → 0; helper
//     threw (env/prisma blew up before the helper could absorb) → 1.

import { runMorningDigest } from '../src/lib/business/daily-digest';
import { prisma } from '../src/lib/db';
import { env } from '../src/lib/env';

async function main(): Promise<void> {
  const recipient = env.POLSIA_OWNER_EMAIL ?? 'support@polsia.com';

  let ownerUserId: string | null = null;
  try {
    const founder = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true },
    });
    ownerUserId = founder?.id ?? null;
  } catch {
    ownerUserId = null;
  }

  const result = await runMorningDigest({
    recipient,
    ownerUserId,
    now: new Date(),
  });

  await prisma.$disconnect();

  const ok = result.status === 'OK' || result.status === 'EMPTY' || result.status === 'SKIPPED';
  process.exit(ok ? 0 : 1);
}

main().catch(() => {
  process.exit(1);
});
