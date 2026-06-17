import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import { runGuardedReplay } from "./guarded-replay";

const OUT = join(process.cwd(), "evidence", "research");

export function runResearchNode(args: string[] = []): void {
  const file = args.find((a) => !a.startsWith("--")) ?? "data/snapshots/2026-06-15.jsonl";
  const snapshots = loadSnapshots(file).filter((s) => s.rows.some((r) => r.equity));
  const split = Math.max(1, Math.floor(snapshots.length * 0.6));
  const train = snapshots.slice(0, split);
  const test = snapshots.slice(split);
  mkdirSync(OUT, { recursive: true });
  const thresholds = [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2];
  const leaderboard = thresholds.map((threshold) => {
    const trainSignals = train.reduce((sum, snap) => sum + snap.rows.filter((r) => r.premiumVsEquityPct != null && Math.abs(r.premiumVsEquityPct) >= threshold).length, 0);
    const testSignals = test.reduce((sum, snap) => sum + snap.rows.filter((r) => r.premiumVsEquityPct != null && Math.abs(r.premiumVsEquityPct) >= threshold).length, 0);
    return { threshold, trainSignals, testSignals, stability: testSignals ? Number((Math.min(trainSignals, testSignals) / Math.max(trainSignals, testSignals)).toFixed(4)) : 0 };
  }).sort((a, b) => b.stability - a.stability || b.testSignals - a.testSignals);
  const best = leaderboard[0] ?? { threshold: 0.5, trainSignals: 0, testSignals: 0, stability: 0 };
  writeFileSync(join(OUT, "leaderboard.json"), JSON.stringify({ recording: file, snapshots: snapshots.length, split, leaderboard }, null, 2) + "\n");
  writeFileSync(join(OUT, "best-config.json"), JSON.stringify({ strategy: "certificate_gated_long_only_fade", selectedThresholdPct: best.threshold, selectionMetric: "train/test signal stability" }, null, 2) + "\n");
  writeFileSync(join(OUT, "walk-forward-report.md"), [
    "# NightDesk Research Node",
    "",
    `Recording: ${file}`,
    `Total snapshots with equity anchors: ${snapshots.length}`,
    `Train snapshots: ${train.length}`,
    `Test snapshots: ${test.length}`,
    `Selected threshold: ${best.threshold}%`,
    "",
    "This report is intentionally conservative: it selects a threshold by signal stability, not same-sample PnL. The profitable guarded replay remains execution evidence unless an out-of-sample recording is provided.",
    "",
    "To regenerate execution evidence:",
    "",
    "```bash",
    "npm run paper-replay",
    "```",
  ].join("\n") + "\n");
  // Keep the existing profitable guarded replay artifact fresh as part of the research pack.
  runGuardedReplay([file]);
  console.log("\nNIGHTDESK RESEARCH NODE COMPLETE");
  console.log(`selected threshold: ${best.threshold}%`);
  console.log(`report: ${join(OUT, "walk-forward-report.md")}`);
}

if (process.argv[1]?.endsWith("research-node.ts")) runResearchNode(process.argv.slice(2));
