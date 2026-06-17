// Risk-adjusted performance report: turns the paper-trading session PnL series into the
// Sharpe/Sortino/Calmar/profit-factor/expectancy table trader-judges expect, with an honest sample-size
// caveat on every block. Reads existing evidence CSVs; writes evidence/performance/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { summarizePerformance, MIN_RELIABLE_N, type PerformanceSummary } from "./performance-stats";

const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "performance");
const START_BALANCE = 1000;

/** Extract a per-session net_pnl series from an evidence CSV (optionally filtered by a `mode` column). */
function pnlSeries(rel: string, opts: { mode?: string } = {}): { pnls: number[]; recordings: string[] } {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return { pnls: [], recordings: [] };
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  if (lines.length < 2) return { pnls: [], recordings: [] };
  const headers = lines[0].split(",");
  const pnlIdx = headers.indexOf("net_pnl");
  const recIdx = headers.indexOf("recording");
  const modeIdx = headers.indexOf("mode");
  if (pnlIdx < 0) return { pnls: [], recordings: [] };
  const pnls: number[] = [];
  const recordings: string[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    if (opts.mode && modeIdx >= 0 && cells[modeIdx] !== opts.mode) continue;
    const v = Number(cells[pnlIdx]);
    if (Number.isFinite(v)) {
      pnls.push(v);
      recordings.push(recIdx >= 0 ? cells[recIdx] : "");
    }
  }
  return { pnls, recordings };
}

interface Block {
  label: string;
  source: string;
  recordings: string[];
  summary: PerformanceSummary;
}

export function runPerformanceReport(): Block[] {
  mkdirSync(OUT, { recursive: true });
  const blocks: Block[] = [];

  const fwdForward = pnlSeries("evidence/forward-paper-daemon/session-results.csv", { mode: "forward_oos_paper" });
  blocks.push({
    label: "Forward champion — FORWARD (out-of-sample) sessions only",
    source: "evidence/forward-paper-daemon/session-results.csv (mode=forward_oos_paper)",
    recordings: fwdForward.recordings,
    summary: summarizePerformance(fwdForward.pnls, START_BALANCE),
  });

  const fwdAll = pnlSeries("evidence/forward-paper-daemon/session-results.csv");
  blocks.push({
    label: "Forward champion — all sessions (forward + in-sample replay)",
    source: "evidence/forward-paper-daemon/session-results.csv",
    recordings: fwdAll.recordings,
    summary: summarizePerformance(fwdAll.pnls, START_BALANCE),
  });

  const globalChamp = pnlSeries("evidence/alpha-championship/global-champion-session-results.csv");
  blocks.push({
    label: "Raw-PnL championship — global champion, per session (in-sample)",
    source: "evidence/alpha-championship/global-champion-session-results.csv",
    recordings: globalChamp.recordings,
    summary: summarizePerformance(globalChamp.pnls, START_BALANCE),
  });

  writeFileSync(
    join(OUT, "risk-adjusted-stats.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), startBalance: START_BALANCE, minReliableN: MIN_RELIABLE_N, blocks }, null, 2) + "\n",
  );

  const fmtPf = (pf: number | null) => (pf === null ? "∞ (no losing periods)" : pf.toFixed(2));
  const md: string[] = [
    "# Risk-Adjusted Performance",
    "",
    "Per-period (per-session) statistics on NightDesk's paper-trading record. Ratios are NOT annualized",
    `(the session series is short and irregular — annualizing would invent precision). Any block with`,
    `n < ${MIN_RELIABLE_N} reports its numbers but is flagged **not yet statistically reliable**.`,
    "",
  ];
  for (const b of blocks) {
    const s = b.summary;
    md.push(
      `## ${b.label}`,
      "",
      `Source: \`${b.source}\``,
      `Sessions (n): **${s.n}** — ${s.reliable ? "reliable" : "NOT yet reliable"}. ${s.reliabilityNote}`,
      "",
      "| Metric | Value |",
      "|---|---|",
      `| Total PnL | ${s.totalPnl.toFixed(2)} USDT |`,
      `| Total return | ${s.totalReturnPct.toFixed(2)}% |`,
      `| Mean return / session | ${s.meanReturnPct.toFixed(3)}% |`,
      `| Sharpe (per session) | ${s.sharpe.toFixed(2)} |`,
      `| Sortino (per session) | ${s.sortino.toFixed(2)} |`,
      `| Calmar | ${s.calmar.toFixed(2)} |`,
      `| Max drawdown | ${s.maxDrawdownPct.toFixed(2)}% |`,
      `| Profit factor | ${fmtPf(s.profitFactor)} |`,
      `| Expectancy / session | ${s.expectancy.toFixed(2)} USDT |`,
      `| Win rate | ${s.winRatePct.toFixed(1)}% (${s.wins}W / ${s.losses}L) |`,
      "",
    );
  }
  md.push(
    "> The forward (out-of-sample) block is the honest headline — it grows as post-freeze sessions are",
    "> recorded. Until it crosses the reliability threshold, treat its ratios as directional only.",
    "",
  );
  writeFileSync(join(OUT, "risk-adjusted-stats.md"), md.join("\n"));

  const fwd = blocks[0].summary;
  console.log("NIGHTDESK PERFORMANCE REPORT COMPLETE");
  console.log(`forward sessions n=${fwd.n} reliable=${fwd.reliable} · report: ${join(OUT, "risk-adjusted-stats.md")}`);
  return blocks;
}

if (process.argv[1]?.endsWith("performance-report.ts")) runPerformanceReport();
