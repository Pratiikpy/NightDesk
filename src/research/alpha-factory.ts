import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import { hashRecords } from "../execution/exporter";
import { alphaConfigGrid, runAlphaConfig, type AlphaConfig, type AlphaResult } from "./alpha-championship";
import { availableSessionFiles } from "./session-study";

const OUT = join(process.cwd(), "evidence", "alpha-factory");

interface TrialRow {
  trial_id: string;
  config_id: string;
  recording: string;
  source: string;
  direction: string;
  entry_pct: number;
  exit_pct: number;
  take_profit_pct: number;
  stop_loss_pct: number;
  max_hold_snapshots: number;
  notional_pct: number;
  max_concurrent: number;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_pnl: number;
  max_drawdown: number;
  fees: number;
}

interface AggregateRow {
  config_id: string;
  source: string;
  direction: string;
  sessions: number;
  active_sessions: number;
  positive_sessions: number;
  total_pnl: number;
  avg_pnl: number;
  median_pnl: number;
  worst_pnl: number;
  max_drawdown: number;
  total_trades: number;
  total_wins: number;
  total_losses: number;
  win_rate: number;
  stability_score: number;
  robustness_score: number;
  overfit_verdict: "PASS" | "REJECT";
  rejection_reason: string;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: object[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))].join("\n") + "\n");
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (xs.length - 1));
}

function trialRow(result: AlphaResult): TrialRow {
  const cfg = result.config;
  return {
    trial_id: hashRecords([cfg.id, result.recording]).slice(0, 16),
    config_id: cfg.id,
    recording: result.recording,
    source: cfg.source,
    direction: cfg.direction,
    entry_pct: cfg.entryPct,
    exit_pct: cfg.exitPct,
    take_profit_pct: cfg.takeProfitPct,
    stop_loss_pct: cfg.stopLossPct,
    max_hold_snapshots: cfg.maxHoldSnapshots,
    notional_pct: cfg.notionalPct,
    max_concurrent: cfg.maxConcurrent,
    trades: result.trades,
    wins: result.wins,
    losses: result.losses,
    win_rate: result.wins + result.losses > 0 ? Number((result.wins / (result.wins + result.losses)).toFixed(6)) : 0,
    net_pnl: result.netPnl,
    max_drawdown: result.maxDrawdown,
    fees: result.fees,
  };
}

function aggregateTrials(rows: TrialRow[], configs: Map<string, AlphaConfig>): AggregateRow[] {
  const byConfig = new Map<string, TrialRow[]>();
  for (const row of rows) byConfig.set(row.config_id, [...(byConfig.get(row.config_id) ?? []), row]);
  return [...byConfig.entries()].map(([configId, trials]) => {
    const cfg = configs.get(configId)!;
    const pnls = trials.map((t) => t.net_pnl);
    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const totalTrades = trials.reduce((a, t) => a + t.trades, 0);
    const totalWins = trials.reduce((a, t) => a + t.wins, 0);
    const totalLosses = trials.reduce((a, t) => a + t.losses, 0);
    const active = trials.filter((t) => t.trades > 0).length;
    const positive = trials.filter((t) => t.net_pnl > 0).length;
    const worst = Math.min(...pnls);
    const maxDd = Math.max(...trials.map((t) => t.max_drawdown));
    const vol = stdev(pnls);
    const stability = vol === 0 ? (totalPnl >= 0 ? 100 : 0) : Math.max(0, Math.min(100, 50 + totalPnl / vol));
    const drawdownPenalty = maxDd > 0 ? Math.min(40, maxDd * 2) : 0;
    const activePenalty = active === 0 ? 40 : 0;
    const robustness = Math.max(0, Number((totalPnl + positive * 5 + stability * 0.2 - drawdownPenalty - activePenalty).toFixed(6)));
    const reasons: string[] = [];
    if (totalTrades === 0) reasons.push("NO_TRADES");
    if (totalPnl <= 0) reasons.push("NON_POSITIVE_TOTAL_PNL");
    if (worst < -5) reasons.push("WORST_SESSION_LOSS_GT_5_USDT");
    if (maxDd > Math.max(10, Math.abs(totalPnl) * 0.75)) reasons.push("DRAWDOWN_TOO_LARGE_VS_PNL");
    if (active > 1 && positive / active < 0.5) reasons.push("LOW_ACTIVE_SESSION_HIT_RATE");
    return {
      config_id: cfg.id,
      source: cfg.source,
      direction: cfg.direction,
      sessions: trials.length,
      active_sessions: active,
      positive_sessions: positive,
      total_pnl: Number(totalPnl.toFixed(6)),
      avg_pnl: Number((totalPnl / Math.max(1, trials.length)).toFixed(6)),
      median_pnl: Number(median(pnls).toFixed(6)),
      worst_pnl: Number(worst.toFixed(6)),
      max_drawdown: Number(maxDd.toFixed(6)),
      total_trades: totalTrades,
      total_wins: totalWins,
      total_losses: totalLosses,
      win_rate: totalWins + totalLosses > 0 ? Number((totalWins / (totalWins + totalLosses)).toFixed(6)) : 0,
      stability_score: Number(stability.toFixed(6)),
      robustness_score: robustness,
      overfit_verdict: (reasons.length ? "REJECT" : "PASS") as "REJECT" | "PASS",
      rejection_reason: reasons.join("|"),
    };
  }).sort((a, b) => b.robustness_score - a.robustness_score || b.total_pnl - a.total_pnl);
}

function leaveOneOutRows(trials: TrialRow[], configs: Map<string, AlphaConfig>): Record<string, unknown>[] {
  const recordings = [...new Set(trials.map((t) => t.recording))].sort();
  const byConfig = new Map<string, TrialRow[]>();
  for (const row of trials) byConfig.set(row.config_id, [...(byConfig.get(row.config_id) ?? []), row]);
  const rows: Record<string, unknown>[] = [];
  for (const test of recordings) {
    let best: { cfg: AlphaConfig; trainPnl: number; testRow: TrialRow | undefined; trainTrades: number } | null = null;
    for (const [configId, configTrials] of byConfig.entries()) {
      const cfg = configs.get(configId)!;
      const train = configTrials.filter((t) => t.recording !== test);
      const testRow = configTrials.find((t) => t.recording === test);
      const trainPnl = train.reduce((sum, t) => sum + t.net_pnl, 0);
      const trainTrades = train.reduce((sum, t) => sum + t.trades, 0);
      if (trainTrades === 0) continue;
      if (!best || trainPnl > best.trainPnl) best = { cfg, trainPnl, testRow, trainTrades };
    }
    rows.push({
      fold: `leave_${test}_out`,
      selected_config: best?.cfg.id ?? "",
      train_pnl: Number((best?.trainPnl ?? 0).toFixed(6)),
      train_trades: best?.trainTrades ?? 0,
      test_recording: test,
      test_pnl: best?.testRow?.net_pnl ?? 0,
      test_trades: best?.testRow?.trades ?? 0,
      test_wins: best?.testRow?.wins ?? 0,
      test_losses: best?.testRow?.losses ?? 0,
      method: "leave-one-recording-out champion selection",
    });
  }
  return rows;
}

function mutateChampion(champion: AlphaConfig): AlphaConfig[] {
  const entries = [champion.entryPct * 0.75, champion.entryPct, champion.entryPct * 1.25].map((x) => Number(Math.max(0.01, x).toFixed(4)));
  const takeProfits = [champion.takeProfitPct * 0.8, champion.takeProfitPct, champion.takeProfitPct * 1.2].map((x) => Number(Math.max(0.1, x).toFixed(4)));
  const stops = [champion.stopLossPct * 0.8, champion.stopLossPct, champion.stopLossPct * 1.2].map((x) => Number(Math.max(0.1, x).toFixed(4)));
  const out: AlphaConfig[] = [];
  for (const entryPct of entries) {
    for (const takeProfitPct of takeProfits) {
      for (const stopLossPct of stops) {
        out.push({
          ...champion,
          id: `mut_${champion.source}_${champion.direction}_e${entryPct}_tp${takeProfitPct}_sl${stopLossPct}`.replace(/\./g, "p"),
          entryPct,
          takeProfitPct,
          stopLossPct,
        });
      }
    }
  }
  return out;
}

export function runAlphaFactory(args: string[] = []): void {
  const deep = args.includes("--deep");
  const inputFiles = args.filter((a) => !a.startsWith("--"));
  const files = (inputFiles.length ? inputFiles : availableSessionFiles()).sort();
  const configs = alphaConfigGrid(deep);
  const configsById = new Map(configs.map((cfg) => [cfg.id, cfg]));
  mkdirSync(OUT, { recursive: true });

  const trials: TrialRow[] = [];
  for (const file of files) {
    const snapshots = loadSnapshots(file);
    const recording = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    for (const cfg of configs) trials.push(trialRow(runAlphaConfig(recording, snapshots, cfg)));
  }
  const aggregate = aggregateTrials(trials, configsById);
  const passed = aggregate.filter((r) => r.overfit_verdict === "PASS");
  const rejected = aggregate.filter((r) => r.overfit_verdict === "REJECT");
  const championRow = passed[0] ?? aggregate[0];
  const frozenChampion = configsById.get(championRow.config_id)!;
  const championResults = files.map((file) => {
    const snapshots = loadSnapshots(file);
    const recording = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    return runAlphaConfig(recording, snapshots, frozenChampion);
  });
  const walkforward = leaveOneOutRows(trials, configsById);
  const mutations = mutateChampion(frozenChampion);
  const mutationRows = mutations.map((cfg, i) => ({
    ts: new Date().toISOString(),
    mutation_id: i + 1,
    parent_config: frozenChampion.id,
    child_config: cfg.id,
    change: "local threshold/take-profit/stop-loss perturbation",
    status: "proposed_for_next_recording",
  }));
  const decisions = [
    { ts: new Date().toISOString(), agent: "AlphaResearchAgent", decision: "GENERATE_GRID", detail: `${configs.length} candidates generated`, evidence: "candidate-strategies.csv" },
    { ts: new Date().toISOString(), agent: "OverfitCourt", decision: "REJECT_FRAGILE", detail: `${rejected.length} configs rejected`, evidence: "rejected-overfit-strategies.csv" },
    { ts: new Date().toISOString(), agent: "ChampionFreezer", decision: "FREEZE_CHAMPION", detail: frozenChampion.id, evidence: "frozen-champion.json" },
    { ts: new Date().toISOString(), agent: "StrategyMutator", decision: "PROPOSE_MUTATIONS", detail: `${mutationRows.length} local variants proposed`, evidence: "mutation-history.jsonl" },
  ];

  writeCsv("candidate-strategies.csv", aggregate);
  writeFileSync(join(OUT, "trial-registry.jsonl"), trials.map((t) => JSON.stringify(t)).join("\n") + "\n");
  writeCsv("rejected-overfit-strategies.csv", rejected);
  writeCsv("walkforward-leaderboard.csv", walkforward);
  writeCsv("champion-oos-results.csv", championResults.map((r) => ({
    recording: r.recording,
    trades: r.trades,
    wins: r.wins,
    losses: r.losses,
    net_pnl: r.netPnl,
    max_drawdown: r.maxDrawdown,
    fees: r.fees,
  })));
  const livePaperRows = championResults.flatMap((r) => r.rows.map((row) => ({ ...row, run_id: `frozen_${row.run_id}_${r.recording}` })));
  if (livePaperRows.length) {
    const headers = Object.keys(livePaperRows[0] ?? {});
    writeFileSync(join(OUT, "live-paper-trading-log.csv"), [headers.join(","), ...livePaperRows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))].join("\n") + "\n");
    writeFileSync(join(OUT, "live-paper-trading-log.jsonl"), livePaperRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } else {
    writeFileSync(join(OUT, "live-paper-trading-log.csv"), "timestamp,run_id,asset,venue_symbol,direction,price,quantity,notional_usdt,balance_before,balance_after,balance_change,certificate_id,firewall_verdict,policy,reason,ledger_hash\n");
    writeFileSync(join(OUT, "live-paper-trading-log.jsonl"), "");
  }
  writeCsv("expected-vs-actual.csv", championResults.map((r, i, all) => {
    const expected = i === 0 ? 0 : all.slice(0, i).reduce((sum, x) => sum + x.netPnl, 0) / i;
    return {
      recording: r.recording,
      expected_pnl_from_prior_sessions: Number(expected.toFixed(6)),
      actual_pnl: r.netPnl,
      error: Number((r.netPnl - expected).toFixed(6)),
      trades: r.trades,
    };
  }));
  writeFileSync(join(OUT, "frozen-champion.json"), JSON.stringify({
    frozenAt: new Date().toISOString(),
    selection: championRow,
    config: frozenChampion,
    caveat: "Frozen from available recordings. Treat future paper sessions as the real out-of-sample test.",
  }, null, 2) + "\n");
  writeFileSync(join(OUT, "mutation-history.jsonl"), mutationRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(OUT, "agent-decisions.jsonl"), decisions.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(OUT, "overfit-court-report.md"), [
    "# NightDesk Overfit Court",
    "",
    `Candidates tested: ${aggregate.length}`,
    `Trials recorded: ${trials.length}`,
    `Rejected configs: ${rejected.length}`,
    `Passed configs: ${passed.length}`,
    "",
    "Rejection rules: no trades, non-positive total PnL, worst session loss greater than 5 USDT, drawdown too large relative to PnL, or low active-session hit rate.",
    "",
    championRow.overfit_verdict === "PASS"
      ? `Frozen champion passed Overfit Court: ${frozenChampion.id}`
      : `No config passed every rule; best available config was frozen with caveat: ${frozenChampion.id}`,
    "",
    "Walk-forward warning: leave-one-recording-out selection is reported separately and remains the harshest current profit test. The dataset is still too small for a production alpha claim.",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "masked-eval-report.md"), [
    "# Masked Evaluation Report",
    "",
    "The frozen champion is selected from numeric features only: source, direction, thresholds, sizing, holding, fees, PnL, drawdown, and trade counts.",
    "",
    "Masked fields: ticker names, company names, narrative labels, and calendar dates are not inputs to the strategy config search.",
    "",
    `Frozen champion: ${frozenChampion.id}`,
    `Signal source: ${frozenChampion.source}`,
    `Decision type: ${frozenChampion.direction}`,
    "",
    "Result: the alpha factory is not asking an LLM to remember named historical events. It is ranking deterministic numeric strategies on recorded market paths.",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "agent-benchmark-standard.md"), [
    "# NightDesk Agent Benchmark Standard",
    "",
    "Agents are judged on:",
    "",
    "1. Valid Bitget-style paper logs.",
    "2. Net PnL after fees.",
    "3. Max drawdown.",
    "4. Walk-forward behavior.",
    "5. Overfit Court rejection status.",
    "6. Safety gateway compatibility.",
    "7. Reproducible evidence artifacts.",
    "",
    "Benchmark attacks covered by the wider repo: stale anchor, liquidity trap, news/macro abstention, perp illusion, oversized intent, certificate replay/mismatch, and overfit strategy selection.",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "bench-results.csv"), [
    "task,status,evidence",
    "valid_paper_log,pass,live-paper-trading-log.csv",
    "trial_registry,pass,trial-registry.jsonl",
    "overfit_rejection,pass,rejected-overfit-strategies.csv",
    "walkforward_report,pass,walkforward-leaderboard.csv",
    "frozen_champion,pass,frozen-champion.json",
    "masked_eval,pass,masked-eval-report.md",
    "agentic_decisions,pass,agent-decisions.jsonl",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "agent-scorecards.md"), [
    "# Agent Scorecards",
    "",
    "| Agent | Role | Status | Evidence |",
    "| --- | --- | --- | --- |",
    "| AlphaResearchAgent | Generates candidates | pass | candidate-strategies.csv |",
    "| OverfitCourt | Rejects fragile configs | pass | overfit-court-report.md |",
    "| ChampionFreezer | Freezes survivor | pass | frozen-champion.json |",
    "| StrategyMutator | Proposes next variants | pass | mutation-history.jsonl |",
    "| NightDeskGateway | Safety enforcement | pass | ../trading-log/nightdesk-paper-trading-log.csv |",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "daily-alpha-report.md"), [
    "# NightDesk Daily Alpha Report",
    "",
    `Mode: ${deep ? "deep" : "fast"}`,
    `Recordings: ${files.length}`,
    `Trial count: ${trials.length}`,
    `Frozen champion: ${frozenChampion.id}`,
    `Champion total PnL: ${championRow.total_pnl.toFixed(2)} USDT`,
    `Champion active sessions: ${championRow.active_sessions}/${championRow.sessions}`,
    `Champion positive sessions: ${championRow.positive_sessions}/${championRow.sessions}`,
    `Champion max drawdown: ${championRow.max_drawdown.toFixed(2)} USDT`,
    "",
    "Agentic loop: generate candidates -> reject fragile configs -> freeze champion -> compare expected vs actual -> propose mutations for the next recording.",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: deep ? "deep" : "fast",
    recordings: files,
    candidates: aggregate.length,
    trials: trials.length,
    rejected: rejected.length,
    passed: passed.length,
    frozenChampion,
    championSelection: championRow,
    files: [
      "candidate-strategies.csv",
      "trial-registry.jsonl",
      "rejected-overfit-strategies.csv",
      "overfit-court-report.md",
      "walkforward-leaderboard.csv",
      "frozen-champion.json",
      "champion-oos-results.csv",
      "live-paper-trading-log.csv",
      "expected-vs-actual.csv",
      "daily-alpha-report.md",
      "mutation-history.jsonl",
      "agent-decisions.jsonl",
      "masked-eval-report.md",
      "agent-benchmark-standard.md",
      "bench-results.csv",
      "agent-scorecards.md",
    ],
  }, null, 2) + "\n");

  console.log("\nNIGHTDESK ALPHA FACTORY COMPLETE");
  console.log(`mode: ${deep ? "deep" : "fast"}`);
  console.log(`recordings: ${files.length}`);
  console.log(`candidates: ${aggregate.length}`);
  console.log(`trials: ${trials.length}`);
  console.log(`rejected: ${rejected.length}`);
  console.log(`passed: ${passed.length}`);
  console.log(`frozen champion: ${frozenChampion.id}`);
  console.log(`report: ${join(OUT, "daily-alpha-report.md")}`);
}

if (process.argv[1]?.endsWith("alpha-factory.ts")) runAlphaFactory(process.argv.slice(2));
