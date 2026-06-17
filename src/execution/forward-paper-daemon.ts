import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import { hashRecords } from "./exporter";
import { runAlphaConfig, type AlphaConfig } from "../research/alpha-championship";
import { availableSessionFiles } from "../research/session-study";

const OUT = join(process.cwd(), "evidence", "forward-paper-daemon");
const FACTORY = join(process.cwd(), "evidence", "alpha-factory");
const LOCKED = join(FACTORY, "frozen-champion.locked.json");
const FROZEN = join(FACTORY, "frozen-champion.json");

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

/**
 * Load the champion config. A *locked* copy (`frozen-champion.locked.json`) wins if present: once you
 * lock the champion, a later `alpha:factory` re-fit can never disturb the forward track record, so the
 * forward sessions stay genuinely out-of-sample. Falls back to the latest `frozen-champion.json`.
 */
function loadFrozenChampion(): { champ: FrozenChampionFile; locked: boolean } {
  const file = existsSync(LOCKED) ? LOCKED : FROZEN;
  if (!existsSync(file)) throw new Error("Missing frozen champion. Run npm run alpha:factory first, then lock it.");
  return { champ: JSON.parse(readFileSync(file, "utf8")) as FrozenChampionFile, locked: existsSync(LOCKED) };
}

export function runForwardPaperDaemon(args: string[] = []): void {
  mkdirSync(OUT, { recursive: true });

  // `--lock` snapshots the current frozen champion as the immutable forward-trading champion.
  if (args.includes("--lock")) {
    if (!existsSync(FROZEN)) throw new Error("Nothing to lock: run npm run alpha:factory first.");
    copyFileSync(FROZEN, LOCKED);
    console.log(`NIGHTDESK FORWARD CHAMPION LOCKED: ${LOCKED}`);
  }

  const inputFiles = args.filter((a) => !a.startsWith("--"));
  const files = (inputFiles.length ? inputFiles : availableSessionFiles()).sort();
  const { champ: frozen, locked } = loadFrozenChampion();
  const freezeDay = frozen.frozenAt.slice(0, 10); // YYYY-MM-DD; a session recorded after this is forward/OOS
  const runId = `forward_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const sessionRows: Record<string, unknown>[] = [];
  const allLogs: Record<string, unknown>[] = [];

  for (const file of files) {
    const snapshots = loadSnapshots(file);
    const recording = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    const isForward = recording > freezeDay; // pure string compare on YYYY-MM-DD
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
      // in_sample_replay = champion was fit on this day; forward_oos_paper = recorded after the freeze.
      mode: isForward ? "forward_oos_paper" : "in_sample_replay",
    });
    for (const row of result.rows) {
      allLogs.push({
        ...row,
        run_id: `${runId}_${recording}`,
        champion_id: frozen.config.id,
        frozen_at: frozen.frozenAt,
        sample: isForward ? "forward_oos" : "in_sample",
        forward_session_hash: sessionHash,
      });
    }
  }

  const forwardRows = sessionRows.filter((r) => r.mode === "forward_oos_paper");
  const sum = (rows: Record<string, unknown>[], k: string) => Number(rows.reduce((s, r) => s + Number(r[k]), 0).toFixed(6));

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
        championLocked: locked,
        sessions: sessionRows.length,
        totalPnl: sum(sessionRows, "net_pnl"),
        totalTrades: sessionRows.reduce((s, r) => s + Number(r.trades), 0),
        forwardSessions: forwardRows.length,
        forwardPnl: sum(forwardRows, "net_pnl"),
        forwardTrades: forwardRows.reduce((s, r) => s + Number(r.trades), 0),
        ledgerHash: hashRecords(sessionRows),
        note: "Frozen champion replayed over every recorded session. Sessions recorded after frozen_at are forward/out-of-sample; lock the champion (--lock) so a later re-fit can't disturb the forward track record.",
      },
      null,
      2,
    ) + "\n",
  );
  // Reproducibility run-card: a config hash + a deterministic fingerprint over the per-session
  // outputs (excluding timestamps), so anyone can prove "same locked champion + same recordings =>
  // identical result." NautilusTrader stores no config hash / seed in its run result; this closes that.
  const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
  const championConfigHash = sha256(JSON.stringify(frozen.config));
  const fingerprintBasis = sessionRows.map((r) => [r.recording, r.trades, r.net_pnl, r.max_drawdown, r.mode]);
  const runFingerprint = sha256(JSON.stringify(fingerprintBasis));
  writeFileSync(
    join(OUT, "forward-run-card.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        championId: frozen.config.id,
        championConfigHash,
        frozenAt: frozen.frozenAt,
        championLocked: locked,
        sessions: sessionRows.length,
        forwardSessions: forwardRows.length,
        totalTrades: sessionRows.reduce((s, r) => s + Number(r.trades), 0),
        runFingerprint,
        note: "runFingerprint = SHA-256 over the deterministic per-session outputs (recording, trades, net_pnl, max_drawdown, mode), excluding timestamps. Same locked champion + same recordings => identical fingerprint.",
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
      `Frozen at: ${frozen.frozenAt}${locked ? " (LOCKED)" : " (not locked — run with --lock before submission)"}`,
      `Champion config hash: ${championConfigHash.slice(0, 16)}…`,
      `Run fingerprint: ${runFingerprint.slice(0, 16)}… (same locked champion + same recordings reproduce this exactly)`,
      "",
      "## Forward / out-of-sample track record (the honest number)",
      `Forward sessions (recorded after the freeze): ${forwardRows.length}`,
      `Forward PnL: ${sum(forwardRows, "net_pnl").toFixed(4)} USDT`,
      `Forward trades: ${forwardRows.reduce((s, r) => s + Number(r.trades), 0)}`,
      "",
      "## All sessions (forward + in-sample replay)",
      `Sessions processed: ${sessionRows.length}`,
      `Total PnL: ${sum(sessionRows, "net_pnl").toFixed(4)} USDT`,
      `Total trades: ${sessionRows.reduce((s, r) => s + Number(r.trades), 0)}`,
      "",
      "Rule: the champion config is loaded from `frozen-champion.locked.json` (or `frozen-champion.json`)",
      "and is never changed during the daemon run. Sessions dated after `frozen_at` are genuinely",
      "out-of-sample; the forward record strengthens as more `data/snapshots/*.jsonl` days are recorded.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK FORWARD PAPER DAEMON COMPLETE: ${join(OUT, "forward-paper-daemon-report.md")}`);
  console.log(`forward sessions: ${forwardRows.length} · forward PnL: ${sum(forwardRows, "net_pnl").toFixed(4)} USDT · champion ${locked ? "LOCKED" : "not locked"}`);
}

if (process.argv[1]?.endsWith("forward-paper-daemon.ts")) runForwardPaperDaemon(process.argv.slice(2));
