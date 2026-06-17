import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "daily-promoter");

interface DaemonState {
  championId: string;
  frozenAt: string;
  sessions: number;
  totalPnl: number;
  totalTrades: number;
  ledgerHash: string;
}

interface FactoryManifest {
  championSelection?: {
    avg_pnl?: number;
    total_pnl?: number;
    max_drawdown?: number;
    total_trades?: number;
  };
}

function parseCsv(file: string): Record<string, string>[] {
  if (!existsSync(file)) return [];
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const headers = rows[0]!.split(",");
  return rows.slice(1).map((line) => Object.fromEntries(line.split(",").map((cell, i) => [headers[i] ?? `col${i}`, cell])));
}

export function runDailyPromoter(): void {
  mkdirSync(OUT, { recursive: true });
  const daemonFile = join(process.cwd(), "evidence", "forward-paper-daemon", "daemon-state.json");
  const factoryFile = join(process.cwd(), "evidence", "alpha-factory", "manifest.json");
  if (!existsSync(daemonFile)) throw new Error("Missing forward daemon evidence. Run npm run alpha:paper-daemon first.");
  const daemon = JSON.parse(readFileSync(daemonFile, "utf8")) as DaemonState;
  const factory = existsSync(factoryFile) ? (JSON.parse(readFileSync(factoryFile, "utf8")) as FactoryManifest) : {};
  const sessionRows = parseCsv(join(process.cwd(), "evidence", "forward-paper-daemon", "session-results.csv"));
  const expectedPerSession = Number(factory.championSelection?.avg_pnl ?? 0);
  const expectedTotal = expectedPerSession * daemon.sessions;
  const totalError = daemon.totalPnl - expectedTotal;
  const losingSessions = sessionRows.filter((r) => Number(r.net_pnl) < 0).length;
  const drawdownMax = Math.max(0, ...sessionRows.map((r) => Number(r.max_drawdown)));
  const expectedDd = Number(factory.championSelection?.max_drawdown ?? 0);

  let decision: "KEEP" | "WATCH" | "RETIRE";
  let reason: string;
  if (daemon.totalTrades === 0) {
    decision = "WATCH";
    reason = "no forward trades yet";
  } else if (daemon.totalPnl < Math.min(-5, expectedTotal - Math.abs(expectedTotal) * 1.5) || drawdownMax > Math.max(15, expectedDd * 2.5)) {
    decision = "RETIRE";
    reason = "forward path breached PnL/drawdown tolerance";
  } else if (losingSessions > Math.max(1, Math.floor(daemon.sessions / 2))) {
    decision = "WATCH";
    reason = "too many losing forward sessions";
  } else {
    decision = "KEEP";
    reason = "forward performance inside tolerance";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    championId: daemon.championId,
    frozenAt: daemon.frozenAt,
    decision,
    reason,
    sessions: daemon.sessions,
    expectedTotalPnl: Number(expectedTotal.toFixed(6)),
    actualTotalPnl: daemon.totalPnl,
    expectedVsActualError: Number(totalError.toFixed(6)),
    totalTrades: daemon.totalTrades,
    losingSessions,
    maxObservedDrawdown: drawdownMax,
    ledgerHash: daemon.ledgerHash,
  };
  writeFileSync(join(OUT, "promotion-decision.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(
    join(OUT, "daily-promoter-report.md"),
    [
      "# Daily Promoter",
      "",
      `Champion: ${daemon.championId}`,
      `Decision: ${decision}`,
      `Reason: ${reason}`,
      `Sessions: ${daemon.sessions}`,
      `Expected total PnL: ${expectedTotal.toFixed(4)} USDT`,
      `Actual total PnL: ${daemon.totalPnl.toFixed(4)} USDT`,
      `Error: ${totalError.toFixed(4)} USDT`,
      `Total trades: ${daemon.totalTrades}`,
      `Max observed drawdown: ${drawdownMax.toFixed(4)} USDT`,
      `Ledger hash: ${daemon.ledgerHash}`,
      "",
      "Policy: KEEP means the frozen champion remains active; WATCH means collect more sessions; RETIRE means rerun Alpha Factory and freeze a new champion.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK DAILY PROMOTER COMPLETE: ${join(OUT, "daily-promoter-report.md")}`);
}

if (process.argv[1]?.endsWith("daily-promoter.ts")) runDailyPromoter();
