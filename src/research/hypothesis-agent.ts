// Autonomous research agent (Month 5): turns grounded, point-in-time evidence into falsifiable
// strategy experiments expressed in the typed Strategy DSL. It is deterministic and, by construction,
// CANNOT access held-out outcomes — its only inputs are evidence facts and an as-of timestamp, and it
// uses ONLY facts that were observed at-or-before that timestamp (no future leakage). Each experiment
// carries the evidence citations it is grounded in and passes the DSL safety validator before it is
// emitted. The agent proposes; deterministic code (folds, Overfit Court, gates) disposes.
import type { CouncilEvidenceFact } from "../council/grounding";
import { strategyHash, validateStrategyDsl, type StrategyDslV1 } from "./strategy-dsl";

export interface Hypothesis {
  id: string;
  rationale: string;
  citations: string[]; // evidence fact ids the experiment is grounded in
  strategy: StrategyDslV1;
  strategyHash: string;
}

export interface HypothesisRequest {
  evidence: CouncilEvidenceFact[]; // train-fold / observed evidence ONLY — never held-out outcomes
  asOf: number; // point-in-time cutoff; facts observed after this are ignored (no future leakage)
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Generate falsifiable DSL experiments grounded in the point-in-time evidence available at `asOf`. */
export function generateHypotheses(req: HypothesisRequest): Hypothesis[] {
  // Point-in-time isolation: only facts observed at-or-before asOf and not expired are visible.
  const active = req.evidence.filter((f) => f.observedAt <= req.asOf && f.expiresAt >= req.asOf);
  const byId = new Map(active.map((f) => [f.id, f]));
  const premium = Number(byId.get("market:premium_pct")?.value);
  const magnitude = Number(byId.get("event:magnitude_pct")?.value);
  // Ungrounded request → no hypothesis (the agent never invents a strategy without market + event evidence).
  if (!Number.isFinite(premium) || !Number.isFinite(magnitude)) return [];

  const source: StrategyDslV1["signal"]["source"] = byId.has("market:fair_value") ? "equity_gap" : "perp_gap";
  const base = clamp(Math.abs(premium), 0.3, 3);
  const tp = Number(clamp(Math.abs(magnitude), 0.5, 5).toFixed(3));
  const citations = ["event:magnitude_pct", "market:premium_pct"];
  const out: Hypothesis[] = [];

  // A small, deterministic grid of entry thresholds around the observed gap — every variant is a
  // complete, safety-valid strategy or it is dropped (the agent cannot emit an unsafe experiment).
  for (const k of [0.8, 1.0, 1.2]) {
    const entryPct = Number((base * k).toFixed(3));
    const strategy: StrategyDslV1 = {
      schema: "nightdesk.strategy.v1",
      id: `hyp_${source}_e${entryPct}`.replace(/\./g, "p"),
      signal: { source, direction: "fade", entryPct },
      filters: { eventPolicy: "hard-gates", liquidityPolicy: "positive-depth", anchorPolicy: "two-source-consensus" },
      sizing: { method: "equity-fraction", notionalPct: 0.04, maxConcurrent: 3 },
      entry: { orderType: "marketable-limit", thresholdPct: entryPct },
      exit: { convergencePct: 0.2, takeProfitPct: tp, stopLossPct: 1.25, maxHoldSnapshots: 9999 },
      hedge: { mode: source === "perp_gap" ? "informational-perp" : "none" },
      risk: { certificateRequired: true, hardGatesRequired: true },
      costs: { feePct: 0.32, fillModel: "depth-or-visible-quote" },
    };
    if (validateStrategyDsl(strategy).length > 0) continue;
    out.push({
      id: strategy.id,
      rationale: `fade ${source} at ${entryPct}% entry (observed gap ${premium.toFixed(2)}%, event magnitude ${magnitude.toFixed(2)}%)`,
      citations,
      strategy,
      strategyHash: strategyHash(strategy),
    });
  }
  // Deduplicate by hash (the clamp can collapse variants into the same strategy).
  const seen = new Set<string>();
  return out.filter((h) => (seen.has(h.strategyHash) ? false : (seen.add(h.strategyHash), true)));
}
