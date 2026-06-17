import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "pnl-casefile");

function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

function exists(file: string): boolean {
  return existsSync(join(ROOT, file));
}

function lines(file: string): string[] {
  return read(file).split(/\r?\n/).filter(Boolean);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    const n = line[i + 1];
    if (quoted && c === "\"" && n === "\"") {
      cell += "\"";
      i++;
    } else if (c === "\"") quoted = !quoted;
    else if (c === "," && !quoted) {
      out.push(cell);
      cell = "";
    } else cell += c;
  }
  out.push(cell);
  return out;
}

function parseCsv(file: string): Record<string, string>[] {
  if (!exists(file)) return [];
  const rows = lines(file);
  if (!rows.length) return [];
  const headers = splitCsvLine(rows[0]!);
  return rows.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: Record<string, unknown>[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sum(rows: Record<string, string>[], key: string): number {
  return rows.reduce((s, r) => s + num(r[key]), 0);
}

function logSummary(file: string): { rows: number; fills: number; blocks: number; start: number; end: number; net: number; feesApprox: number; assets: number } {
  const rows = parseCsv(file);
  const fills = rows.filter((r) => r.direction !== "BLOCK");
  const blocks = rows.filter((r) => r.direction === "BLOCK");
  const start = num(rows[0]?.balance_before);
  const end = num(rows[rows.length - 1]?.balance_after);
  const feesApprox = fills.reduce((s, r) => s + Math.max(0, -num(r.balance_change)), 0);
  return { rows: rows.length, fills: fills.length, blocks: blocks.length, start, end, net: end - start, feesApprox, assets: new Set(rows.map((r) => r.asset)).size };
}

function markdownTable(headers: string[], rows: unknown[][]): string[] {
  return [
    `| ${headers.join(" |")} |`,
    `| ${headers.map(() => "---").join(" |")} |`,
    ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" |")} |`),
  ];
}

function guardedDeltaRows(): Record<string, unknown>[] {
  const arena = exists("evidence/agent-arena-v2/arena-v2-summary.json")
    ? JSON.parse(read("evidence/agent-arena-v2/arena-v2-summary.json")) as { summary: Record<string, unknown>[] }
    : { summary: [] };
  const byAgent = new Map(arena.summary.map((r) => [String(r.agent), r]));
  const bases = ["naive_gap_agent", "perp_trust_agent", "momentum_agent", "news_blind_agent", "random_agent"];
  return bases.filter((base) => byAgent.has(base) && byAgent.has(`${base}_guarded`)).map((base) => {
    const u = byAgent.get(base)!;
    const g = byAgent.get(`${base}_guarded`)!;
    const unguardedPnl = num(u.netPnlUsdt);
    const guardedPnl = num(g.netPnlUsdt);
    const unguardedDd = num(u.maxDrawdownUsdt);
    const guardedDd = num(g.maxDrawdownUsdt);
    return {
      agent_family: base.replace(/_agent$/, ""),
      unguarded_pnl_usdt: unguardedPnl,
      guarded_pnl_usdt: guardedPnl,
      pnl_delta_usdt: Number((guardedPnl - unguardedPnl).toFixed(6)),
      unguarded_max_dd_usdt: unguardedDd,
      guarded_max_dd_usdt: guardedDd,
      dd_delta_usdt: Number((guardedDd - unguardedDd).toFixed(6)),
      unguarded_fills: num(u.fills),
      guarded_fills: num(g.fills),
      unguarded_blocks: num(u.blocks),
      guarded_blocks: num(g.blocks),
      interpretation: guardedPnl >= unguardedPnl ? "guarded_improved_raw_pnl" : guardedDd < unguardedDd ? "guarded_reduced_drawdown" : "guarded_cost_more_in_this_sample",
    };
  });
}

function historyStudy(): Record<string, any> {
  return exists("data/research/history-study-1h.json") ? JSON.parse(read("data/research/history-study-1h.json")) as Record<string, any> : {};
}

export function runPnlCasefile(): void {
  mkdirSync(OUT, { recursive: true });

  if (exists("evidence/trading-log/nightdesk-paper-trading-log.csv")) {
    copyFileSync(join(ROOT, "evidence/trading-log/nightdesk-paper-trading-log.csv"), join(OUT, "01-paper-session.csv"));
  }
  if (exists("evidence/oos/session-summary.csv")) copyFileSync(join(ROOT, "evidence/oos/session-summary.csv"), join(OUT, "07-oos-session-summary.csv"));
  if (exists("evidence/walkforward/fold-results.csv")) copyFileSync(join(ROOT, "evidence/walkforward/fold-results.csv"), join(OUT, "08-walkforward-folds.csv"));
  if (exists("evidence/fill-model/fill-model-report.md")) copyFileSync(join(ROOT, "evidence/fill-model/fill-model-report.md"), join(OUT, "06-fill-realism-report.md"));
  if (exists("evidence/fill-model/slippage-sweep.csv")) copyFileSync(join(ROOT, "evidence/fill-model/slippage-sweep.csv"), join(OUT, "05-liquidity-sweep.csv"));
  if (exists("evidence/walkforward/cost-sweep.csv")) copyFileSync(join(ROOT, "evidence/walkforward/cost-sweep.csv"), join(OUT, "04-cost-sweep.csv"));

  const paper = logSummary("evidence/trading-log/nightdesk-paper-trading-log.csv");
  const guardedReplay = logSummary("evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv");
  const oos = parseCsv("evidence/oos/session-summary.csv");
  const folds = parseCsv("evidence/walkforward/fold-results.csv");
  const delta = guardedDeltaRows();
  const hist = historyStudy();

  writeCsv("02-guarded-vs-unguarded.csv", delta);
  writeFileSync(join(OUT, "02-guarded-vs-unguarded.md"), [
    "# Guarded vs Unguarded Same-Agent Delta",
    "",
    "Each row compares the same intent policy before and after routing through NightDesk. The point is not raw turnover; the point is whether the safety gateway improves PnL, drawdown, or unsafe-action behavior under the same market path.",
    "",
    ...markdownTable(
      ["Agent", "Unguarded PnL", "Guarded PnL", "Delta", "Unguarded DD", "Guarded DD", "Interpretation"],
      delta.map((r) => [r.agent_family, r.unguarded_pnl_usdt, r.guarded_pnl_usdt, r.pnl_delta_usdt, r.unguarded_max_dd_usdt, r.guarded_max_dd_usdt, r.interpretation]),
    ),
  ].join("\n") + "\n");

  const oosBlockedLoss = sum(oos, "blocked_loss");
  const attribution = [
    {
      run_id: "paper_session",
      gross_edge_estimate_usdt: Number((paper.net + paper.feesApprox).toFixed(6)),
      fees_spread_slippage_estimate_usdt: Number((-paper.feesApprox).toFixed(6)),
      blocked_loss_estimate_usdt: 0,
      missed_profit_estimate_usdt: "not_measured",
      net_pnl_usdt: Number(paper.net.toFixed(6)),
      claim: "execution_record_not_alpha",
    },
    {
      run_id: "guarded_replay",
      gross_edge_estimate_usdt: Number((guardedReplay.net + guardedReplay.feesApprox).toFixed(6)),
      fees_spread_slippage_estimate_usdt: Number((-guardedReplay.feesApprox).toFixed(6)),
      blocked_loss_estimate_usdt: Number(oosBlockedLoss.toFixed(6)),
      missed_profit_estimate_usdt: "not_measured",
      net_pnl_usdt: Number(guardedReplay.net.toFixed(6)),
      claim: "same_sample_execution_evidence",
    },
  ];
  writeCsv("03-pnl-attribution.csv", attribution);
  writeFileSync(join(OUT, "03-pnl-attribution.md"), [
    "# PnL Attribution",
    "",
    "This decomposes current evidence into gross edge estimate, cost drag, blocked-loss estimate, and final net PnL. `missed_profit_estimate` is marked not measured where the current artifacts do not yet support a clean false-block calculation.",
    "",
    ...markdownTable(
      ["Run", "Gross Edge Est.", "Costs Est.", "Blocked Loss Est.", "Net PnL", "Claim"],
      attribution.map((r) => [r.run_id, r.gross_edge_estimate_usdt, r.fees_spread_slippage_estimate_usdt, r.blocked_loss_estimate_usdt, r.net_pnl_usdt, r.claim]),
    ),
  ].join("\n") + "\n");

  writeFileSync(join(OUT, "tradeability-bridge.md"), [
    "# Tradeability Bridge",
    "",
    "Research edge is not treated as executable edge until it survives costs, fill realism, and certificate checks.",
    "",
    ...markdownTable(
      ["Layer", "Evidence", "Status"],
      [
        ["Premium-space signal", `${hist.basisBacktest?.trades ?? "n/a"} trades, ${hist.basisBacktest?.totalPnlPct ?? "n/a"}pp net`, "research evidence"],
        ["Random baseline", `${hist.control?.randomEntry?.basisPnlPct ?? "n/a"}pp`, "edge over random is tracked"],
        ["Cost sweep", `${hist.costSweep?.length ?? 0} fee points`, "partially supported"],
        ["Fill realism", "empty/crossed/stale/wide/partial/normal cases", "supported by fill-model report"],
        ["Certificate approval", "paper-session + guarded replay certificates", "supported"],
        ["Live Bitget data", "read-only public snapshot", "supported"],
      ],
    ),
  ].join("\n") + "\n");

  writeFileSync(join(OUT, "perp-leg-autopsy.md"), [
    "# Perp-Leg Autopsy",
    "",
    "The current historical study shows a split: premium-space basis evidence is strong, while the liquid perp-leg backtest is negative. This is not hidden; it is the main execution research warning.",
    "",
    ...markdownTable(
      ["Hypothesis", "Current Evidence", "Conclusion"],
      [
        ["Perp is informational anchor, not hedge", `perp convergence ${hist.perpLeg?.convergence?.ratePct ?? "n/a"}%, backtest ${hist.perpLeg?.backtest?.totalPnlPct ?? "n/a"}%`, "likely"],
        ["Costs/slippage kill hedge", `${hist.perpLeg?.backtest?.winRatePct ?? "n/a"}% win rate`, "needs deeper order-book validation"],
        ["rToken-only fade cleaner", `guarded replay +${guardedReplay.net.toFixed(2)} USDT`, "promising but same-sample"],
        ["Threshold too low", `${hist.basisBacktest?.trades ?? "n/a"} basis trades`, "needs sensitivity/OOS"],
      ],
    ),
    "",
    "Current approved claim: the perp leg is useful as a diagnostic comparator; it is not yet proven as the production hedge.",
  ].join("\n") + "\n");

  const blockedLossAvoided = Math.abs(oosBlockedLoss);
  const oosBlocks = oos.reduce((s, r) => s + num(r.blocks), 0);
  const blockedLossPerBlock = oosBlocks ? blockedLossAvoided / oosBlocks : 0;
  const falseBlockCostLabel = "not measured";
  writeFileSync(join(OUT, "safety-alpha-report.md"), [
    "# Safety Alpha Report",
    "",
    "Safety alpha is economic value from preventing bad actions, not simply producing a green PnL number.",
    "",
    "The blocked-loss figure below is a raw repeated-intent diagnostic from replay, not a realized cash saving. It is useful for comparing filter pressure and unsafe exposure, but it should not be pitched as literal USDT profit.",
    "",
    ...markdownTable(
      ["Metric", "Value", "Interpretation"],
      [
        ["Raw blocked-loss diagnostic", `${blockedLossAvoided.toFixed(4)} USDT`, "sum of repeated counterfactual losing intents in OOS/session study"],
        ["Mean blocked-loss diagnostic per block", `${blockedLossPerBlock.toFixed(6)} USDT`, "normalizes the repeated-intent exposure"],
        ["False block cost", falseBlockCostLabel, "needs per-block counterfactual winner/loss attribution"],
        ["Guarded replay PnL", `${guardedReplay.net.toFixed(4)} USDT`, "positive same-sample execution evidence"],
        ["Paper session PnL", `${paper.net.toFixed(4)} USDT`, "valid compliance record, not tuned for profit"],
      ],
    ),
  ].join("\n") + "\n");

  writeFileSync(join(OUT, "09-backtest-overfit-report.md"), [
    "# Backtest Overfit Report",
    "",
    "NightDesk separates same-sample threshold selection from out-of-sample claims.",
    "",
    ...markdownTable(
      ["Risk", "Evidence", "Status"],
      [
        ["Same-sample threshold", "guarded replay selects threshold inside recording", "do not claim clean alpha"],
        ["Multiple tested costs", `${hist.costSweep?.length ?? 0} fee points`, "reported"],
        ["Walk-forward capture", `${hist.walkForward?.length ?? 0} folds in history study`, "reported"],
        ["OOS session count", `${oos.length} sessions`, oos.length >= 10 ? "stronger" : "thin"],
        ["Perp-leg contradiction", `${hist.perpLeg?.backtest?.totalPnlPct ?? "n/a"}%`, "explicitly disclosed"],
      ],
    ),
  ].join("\n") + "\n");

  writeFileSync(join(OUT, "10-failure-taxonomy.md"), [
    "# Failure Taxonomy",
    "",
    ...markdownTable(
      ["Failure Mode", "How NightDesk Handles It", "Remaining Gap"],
      [
        ["Stale or missing anchor", "certificate/firewall rejects stale or unknown anchors", "needs more live sessions"],
        ["Research edge not executable", "tradeability bridge and fill realism separate research from execution", "needs deeper L2 history"],
        ["Perp hedge loses money", "perp-leg autopsy labels perp as diagnostic until proven", "needs variants"],
        ["Safety trades too little", "guarded-vs-unguarded deltas report PnL and drawdown", "needs false-block attribution"],
        ["Backtest overfit", "claim standard forbids same-sample alpha claims", "needs more OOS sessions"],
      ],
    ),
  ].join("\n") + "\n");

  const claimRows = [
    ["Produces valid paper logs", "01-paper-session.csv", "Proven"],
    ["Safety blocks unsafe intents", "property tests + evidence artifact verifier", "Proven"],
    ["Guarded path can profit", "guarded replay", "Shown, same-sample"],
    ["Historical basis signal exists", "history-study-1h.json", "Research evidence"],
    ["Tradeable perp hedge works", "perp-leg autopsy", "Not proven"],
    ["OOS economic uplift", "07-oos-session-summary.csv + 08-walkforward-folds.csv", oos.length >= 10 ? "Stronger" : "Thin / in progress"],
  ];
  writeFileSync(join(OUT, "00-executive-summary.md"), [
    "# NightDesk PnL Casefile",
    "",
    "NightDesk PnL is presented as safety-adjusted economic evidence. It does not claim guaranteed alpha or highest raw PnL.",
    "",
    "## Current Claim Table",
    "",
    ...markdownTable(["Claim", "Evidence", "Status"], claimRows),
    "",
    "## Current Numbers",
    "",
    ...markdownTable(
      ["Metric", "Value"],
      [
        ["Paper session", `${paper.start.toFixed(2)} -> ${paper.end.toFixed(2)} USDT (${paper.net.toFixed(4)})`],
        ["Guarded replay", `${guardedReplay.start.toFixed(2)} -> ${guardedReplay.end.toFixed(2)} USDT (${guardedReplay.net.toFixed(4)})`],
        ["OOS sessions", `${oos.length}`],
        ["Walk-forward folds", `${folds.length}`],
        ["Historical basis backtest", `${hist.basisBacktest?.totalPnlPct ?? "n/a"}pp over ${hist.basisBacktest?.trades ?? "n/a"} trades`],
        ["Liquid perp-leg backtest", `${hist.perpLeg?.backtest?.totalPnlPct ?? "n/a"}%`],
      ],
    ),
    "",
    "## Pitch Boundary",
    "",
    "Say: NightDesk is a safety gateway that improves economic quality by blocking unsafe intents and preserving only certificate-approved executable convergence trades.",
    "",
    "Do not say: NightDesk is the highest-PnL bot or that same-sample replay profit proves production alpha.",
  ].join("\n") + "\n");

  const manifestFiles = [
    "00-executive-summary.md",
    "01-paper-session.csv",
    "02-guarded-vs-unguarded.csv",
    "02-guarded-vs-unguarded.md",
    "03-pnl-attribution.csv",
    "03-pnl-attribution.md",
    "04-cost-sweep.csv",
    "05-liquidity-sweep.csv",
    "06-fill-realism-report.md",
    "07-oos-session-summary.csv",
    "08-walkforward-folds.csv",
    "09-backtest-overfit-report.md",
    "10-failure-taxonomy.md",
    "perp-leg-autopsy.md",
    "safety-alpha-report.md",
    "tradeability-bridge.md",
  ];
  const manifest = manifestFiles.map((file) => ({ file: `evidence/pnl-casefile/${file}`, exists: existsSync(join(OUT, file)) }));
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    claimLevel: oos.length >= 10 ? "Level 3/4 candidate" : "Level 2 with early Level 3/4 evidence",
    paper,
    guardedReplay,
    manifest,
  }, null, 2) + "\n");

  console.log("\nNIGHTDESK PNL CASEFILE COMPLETE");
  console.log(`paper net: ${paper.net.toFixed(4)} USDT`);
  console.log(`guarded replay net: ${guardedReplay.net.toFixed(4)} USDT`);
  console.log(`guarded deltas: ${delta.length}`);
  console.log(`report: ${join(OUT, "00-executive-summary.md")}`);
}

if (process.argv[1]?.endsWith("pnl-casefile.ts")) runPnlCasefile();
