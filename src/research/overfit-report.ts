// Standalone Overfit Court selection-bias report. Reads the FROZEN Alpha Factory trial registry and
// champion sessions (no re-search, so the headline numbers cannot drift) and writes the Deflated
// Sharpe / PBO / MinTRL artifacts the cockpit and Overfit Court read. Run: `npm run overfit:stats`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildOverfitInputs, computeOverfitStats, formatOverfitMarkdown, type RegistryRow } from "./overfit-stats";

const OUT = join(process.cwd(), "evidence", "alpha-factory");

function readRegistry(): RegistryRow[] {
  return readFileSync(join(OUT, "trial-registry.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const j = JSON.parse(line) as { config_id: string; recording: string; net_pnl: number };
      return { config_id: j.config_id, recording: j.recording, net_pnl: j.net_pnl };
    });
}

function readChampionPnls(): number[] {
  const lines = readFileSync(join(OUT, "champion-oos-results.csv"), "utf8").trim().split("\n");
  const header = lines[0]!.split(",");
  const pnlIdx = header.indexOf("net_pnl");
  return lines.slice(1).map((l) => Number(l.split(",")[pnlIdx]));
}

export function runOverfitReport(): void {
  if (!existsSync(join(OUT, "trial-registry.jsonl"))) {
    console.error("overfit:stats — trial registry missing; run `npm run alpha:factory` first.");
    process.exitCode = 1;
    return;
  }
  const stats = computeOverfitStats(buildOverfitInputs(readRegistry(), readChampionPnls()));
  writeFileSync(
    join(OUT, "overfit-stats.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "frozen alpha-factory trial registry", ...stats }, null, 2) + "\n",
  );
  writeFileSync(join(OUT, "overfit-court-stats.md"), formatOverfitMarkdown(stats));
  console.log("NIGHTDESK OVERFIT STATS COMPLETE");
  console.log(`  trials N=${stats.nTrials}  sessions T=${stats.nObservations}`);
  console.log(`  raw Sharpe ${stats.rawSharpe}  deflated Sharpe ${(stats.deflatedSharpe * 100).toFixed(1)}%  significant=${stats.deflatedSharpeSignificant}`);
  console.log(`  MinTRL ${stats.minTrackRecordLength ?? "unreachable"}  PBO ${stats.pbo.status === "computed" ? (stats.pbo.value! * 100).toFixed(1) + "%" : stats.pbo.status}`);
  console.log(`  -> ${join(OUT, "overfit-stats.json")}`);
}

if (process.argv[1]?.endsWith("overfit-report.ts")) runOverfitReport();
