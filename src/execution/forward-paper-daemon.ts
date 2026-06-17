import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import { hashRecords } from "./exporter";
import { runAlphaConfig, type AlphaConfig } from "../research/alpha-championship";
import { availableSessionFiles } from "../research/session-study";

const OUT = join(process.cwd(), "evidence", "forward-paper-daemon");

interface FrozenChampionFile {
  frozenAt: string;
  config: AlphaConfig;
  selection?: {
    config_id: string;
    total_pnl: number;
    avg_pnl: number;
    max_drawdown: number;
    total_trades: number;
  };
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: object[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))].join("\n") + "\n");
}

function loadFrozenChampion(): FrozenChampionFile {
  const file = join(process.cwd(), "evidence", "alpha-factory", "frozen-champion.json");
  if (!existsSync(file)) throw new Error("Missing frozen champion. Run npm run alpha:factory first.");
  return JSON.parse(readFileSync(file, "utf8")) as FrozenChampionFile;
}

export function runForwardPaperDaemon(args: string[] = []): void {
  mkdirSync(OUT, { recursive: true });
  const inputFiles = args.filter((a) => !a.startsWith("--"));
  const files = (inputFiles.length ? inputFiles : availableSessionFiles()).sort();
  const frozen = loadFrozenChampion();
  const runId = `forward_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const sessionRows: Record<string, unknown>[] = [];
  const allLogs: Record<string, unknown>[] = [];

  for (const file of files) {
    const snapshots = loadSnapshots(file);
    const recording = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    const result = runAlphaConfig(recording, snapshots, frozen.config);
    const sessionHash = hashRecords([runId, frozen.config.id, recording, result.netPnl, result.trades]);
    sessionRows.push({
      run_id: runId,
      champion_id: frozen.config.id,
      frozen_at: frozen.frozenAt,
      recording,
      snapshots: result.snapshots,
      trades: result.trades,
      wins: result.wins,
      losses: result.losses,
      net_pnl: Number(result.netPnl.toFixed(6)),
      max_drawdown: Number(result.maxDrawdown.toFixed(6)),
      fees: Number(result.fees.toFixed(6)),
      session_hash: sessionHash,
      mode: "frozen_config_forward_paper",
    });
    for (const row of result.rows) {
      allLogs.push({
        ...row,
        run_id: `${runId}_${recording}`,
        champion_id: frozen.config.id,
        frozen_at: frozen.frozenAt,
        forward_session_hash: sessionHash,
      });
    }
  }

  writeCsv("session-results.csv", sessionRows);
  writeCsv("live-paper-trading-log.csv", allLogs);
  writeFileSync(join(OUT, "live-paper-trading-log.jsonl"), allLogs.map((r) => JSON.stringify(r)).join("\n") + (allLogs.length ? "\n" : ""));
  writeFileSync(
    join(OUT, "daemon-state.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runId,
        championId: frozen.config.id,
        frozenAt: frozen.frozenAt,
        sessions: sessionRows.length,
        totalPnl: Number(sessionRows.reduce((sum, r) => sum + Number(r.net_pnl), 0).toFixed(6)),
        totalTrades: sessionRows.reduce((sum, r) => sum + Number(r.trades), 0),
        ledgerHash: hashRecords(sessionRows),
        note: "This daemon replays the frozen champion over available recordings today and appends future OOS evidence as new recordings are added.",
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(OUT, "forward-paper-daemon-report.md"),
    [
      "# Forward Paper Daemon",
      "",
      `Run ID: ${runId}`,
      `Frozen champion: ${frozen.config.id}`,
      `Frozen at: ${frozen.frozenAt}`,
      `Sessions processed: ${sessionRows.length}`,
      `Total PnL: ${sessionRows.reduce((sum, r) => sum + Number(r.net_pnl), 0).toFixed(4)} USDT`,
      `Total trades: ${sessionRows.reduce((sum, r) => sum + Number(r.trades), 0)}`,
      "",
      "Rule: the champion config is loaded from `evidence/alpha-factory/frozen-champion.json` and is not changed during the daemon run.",
      "Future OOS strength improves as more `data/snapshots/*.jsonl` sessions are recorded.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK FORWARD PAPER DAEMON COMPLETE: ${join(OUT, "forward-paper-daemon-report.md")}`);
}

if (process.argv[1]?.endsWith("forward-paper-daemon.ts")) runForwardPaperDaemon(process.argv.slice(2));
