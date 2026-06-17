// Pure aggregation of ledger records into the public scorecard (PRD FR-7.3).
import type { CycleRecord } from "./ledger";
import { brierScore } from "../history/metrics";

export interface Scorecard {
  cycles: number;
  trades: number;
  noTrades: number;
  gated: number;
  abstained: number;
  graded: number;
  wins: number;
  losses: number;
  flats: number;
  hitRatePct: number;
  convergenceCaptured: number;
  convergenceRatePct: number;
  totalSimPnl: number;
  gateBlockCounts: Record<string, number>;
  llmPromptTokens: number;
  llmCompletionTokens: number;
  calibration?: { n: number; brier: number }; // council p_converge vs realized convergence
}

export function buildScorecard(records: CycleRecord[]): Scorecard {
  let trades = 0,
    noTrades = 0,
    gated = 0,
    abstained = 0,
    graded = 0,
    wins = 0,
    losses = 0,
    flats = 0,
    convergenceCaptured = 0,
    totalSimPnl = 0,
    llmPromptTokens = 0,
    llmCompletionTokens = 0;
  const gateBlockCounts: Record<string, number> = {};

  for (const r of records) {
    if (r.usage) {
      llmPromptTokens += r.usage.promptTokens;
      llmCompletionTokens += r.usage.completionTokens;
    }
    if (r.outcome === "no_trade") {
      noTrades++;
      continue;
    }
    if (r.outcome === "abstained") {
      abstained++;
      continue;
    }
    if (r.outcome === "gated") {
      gated++;
      if (r.gateReport) for (const g of r.gateReport.results) if (!g.passed) gateBlockCounts[g.gate] = (gateBlockCounts[g.gate] ?? 0) + 1;
      continue;
    }
    // a placed trade
    trades++;
    if (r.gradePnl != null) {
      graded++;
      totalSimPnl += r.gradePnl;
      if (r.gradePnl > 0) wins++;
      else if (r.gradePnl < 0) losses++;
      else flats++;
      if (r.convergenceCaptured) convergenceCaptured++;
    }
  }

  const preds = records
    .filter((r) => r.gradePnl != null && r.proposal?.pConverge != null)
    .map((r) => ({ p: r.proposal!.pConverge as number, outcome: (r.convergenceCaptured ? 1 : 0) as 0 | 1 }));
  const calibration = preds.length ? { n: preds.length, brier: brierScore(preds) } : undefined;

  return {
    cycles: records.length,
    trades,
    noTrades,
    gated,
    abstained,
    graded,
    wins,
    losses,
    flats,
    hitRatePct: graded ? Number(((wins / graded) * 100).toFixed(1)) : 0,
    convergenceCaptured,
    convergenceRatePct: graded ? Number(((convergenceCaptured / graded) * 100).toFixed(1)) : 0,
    totalSimPnl: Number(totalSimPnl.toFixed(2)),
    gateBlockCounts,
    llmPromptTokens,
    llmCompletionTokens,
    calibration,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Counterfactual judgment summary — graded over the same records. Shared by the orchestrator (live
// SimResult) and the dashboard (reading a persisted ledger), so both report identical numbers.
export interface JudgmentSummary {
  tradedConvergedPct: number; // of actual trades, % that converged
  abstained: { n: number; wouldHaveConvergedPct: number; avgWouldBePnlPct: number };
  gated: { n: number; wouldHaveConvergedPct: number; avgWouldBePnlPct: number };
}

export function summarizeJudgment(records: CycleRecord[]): JudgmentSummary {
  const graded = records.filter((r) => r.gradePnl != null);
  const tradedConvergedPct = graded.length ? Number(((graded.filter((r) => r.convergenceCaptured).length / graded.length) * 100).toFixed(1)) : 0;
  const cfOf = (outcome: string) => {
    const recs = records.filter((r) => r.outcome === outcome && r.counterfactual);
    const n = recs.length;
    return {
      n,
      wouldHaveConvergedPct: n ? Number(((recs.filter((r) => r.counterfactual!.wouldHaveConverged).length / n) * 100).toFixed(1)) : 0,
      avgWouldBePnlPct: n ? Number((recs.reduce((a, r) => a + r.counterfactual!.wouldBePnlPct, 0) / n).toFixed(3)) : 0,
    };
  };
  return { tradedConvergedPct, abstained: cfOf("abstained"), gated: cfOf("gated") };
}


// ─────────────────────────────────────────────────────────────────────────────
// Risk-gate value attribution — does each gate EARN its place? For every gate that blocked a trade,
// we look at the counterfactual: what would that blocked trade have done? A negative avg would-be
// PnL means the gate blocked losers (it added value). (A trade can fail multiple gates; the would-be
// PnL is attributed to each blocker, so this reads "of the trades this gate blocked, they'd have
// averaged X" — a per-gate quality view, not an exclusive split.)
export interface GateAttribution {
  gate: string;
  blocked: number;
  avgWouldBePnlPct: number; // negative = the blocked trades would have lost → gate avoided losses
}

export function attributeGates(records: CycleRecord[]): GateAttribution[] {
  const agg = new Map<string, { n: number; sum: number }>();
  for (const r of records) {
    if (r.outcome !== "gated" || !r.gateReport || !r.counterfactual) continue;
    for (const g of r.gateReport.results) {
      if (g.passed) continue; // only the gate(s) that blocked
      const a = agg.get(g.gate) ?? { n: 0, sum: 0 };
      a.n++;
      a.sum += r.counterfactual.wouldBePnlPct;
      agg.set(g.gate, a);
    }
  }
  return [...agg.entries()]
    .map(([gate, a]) => ({ gate, blocked: a.n, avgWouldBePnlPct: a.n ? Number((a.sum / a.n).toFixed(3)) : 0 }))
    .sort((x, y) => x.avgWouldBePnlPct - y.avgWouldBePnlPct);
}
