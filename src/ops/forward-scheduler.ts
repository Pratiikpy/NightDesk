// Forward-paper scheduler: keeps the forward (out-of-sample) paper-trading record fresh while the
// recorder/OOS daemon captures new days. It re-runs the LOCKED-champion forward daemon on an interval
// so every newly-recorded session gets folded into the forward track record automatically. It does NOT
// record market data itself (the OOS daemon does that) and never re-fits the champion.
//
// Run in the background:  npm run alpha:forward-scheduler
// Custom cadence:         npm run alpha:forward-scheduler -- --interval-ms=7200000
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runForwardPaperDaemon } from "../execution/forward-paper-daemon";

const OUT = join(process.cwd(), "evidence", "forward-paper-daemon");
const DEFAULT_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3h — comfortably catches each new recorded day

function intervalMs(): number {
  const arg = process.argv.find((a) => a.startsWith("--interval-ms="));
  const parsed = arg ? Number(arg.split("=")[1]) : NaN;
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : DEFAULT_INTERVAL_MS;
}

const startedAt = new Date().toISOString();
let runs = 0;
let lastError: string | null = null;

function tick(): void {
  runs += 1;
  try {
    runForwardPaperDaemon([]); // locked champion, all available recordings
    lastError = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error(`[forward-scheduler] run ${runs} failed: ${lastError}`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "scheduler-state.json"),
    JSON.stringify({ startedAt, lastRunAt: new Date().toISOString(), runs, intervalMs: intervalMs(), lastError, status: "running" }, null, 2) + "\n",
  );
  console.log(`[forward-scheduler] run ${runs} complete at ${new Date().toISOString()}`);
}

console.log(`NIGHTDESK FORWARD SCHEDULER START · interval ${Math.round(intervalMs() / 60000)}min · ${startedAt}`);
tick();
setInterval(tick, intervalMs());
