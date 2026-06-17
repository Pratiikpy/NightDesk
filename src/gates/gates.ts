// Risk Engine — 15 hard gates (PRD §8.6). Pure functions, fully unit-tested.
// Pre-trade gates vet a proposal; live gates act on open positions/feeds.
// Every evaluation returns a structured result so gates are countable + demonstrable.

export type DepegState = "NORMAL" | "STRETCHED" | "DISLOCATED";

export interface GateConfig {
  maxPositionPct: number; // gate 1
  maxGrossPct: number; // gate 2
  maxSlippagePct: number; // gate 4
  minConfidence: number; // gate 5
  maxLeverage: number; // gate 6
  maxCorrelated: number; // gate 7
  staleSec: number; // gate 11
  maxDailyDrawdownPct: number; // gate 9
  netEdgeMarginPct: number; // gate 13 — required edge AFTER fees + slippage
  maxPositionVarPct: number; // gate 14 — parametric 95% VaR cap (% of equity)
  maxAnchorDeviationPct: number; // gate 15 — implausible anchor (likely bad/stale print) ceiling
}
export const DEFAULT_GATES: GateConfig = {
  maxPositionPct: 10,
  maxGrossPct: 50,
  maxSlippagePct: 0.3,
  minConfidence: 0.6,
  maxLeverage: 3,
  maxCorrelated: 2,
  staleSec: 60,
  maxDailyDrawdownPct: 3,
  netEdgeMarginPct: 0,
  maxPositionVarPct: 1.5,
  maxAnchorDeviationPct: 25,
};

export interface Proposal {
  ticker: string;
  instrument: "spot" | "perp";
  side: "buy" | "sell";
  sizePct: number; // requested size as % of equity
  expectedEdgePct: number;
  effectiveLeverage: number;
  stop?: number;
  isBasisArb?: boolean;
}

export interface PreTradeCtx {
  existingTickerPct: number;
  grossPct: number;
  pegState: DepegState | null;
  estSlippagePct: number;
  eventConfidence: number;
  numericGroundingPassed: boolean;
  correlatedOpenCount: number;
  feeRoundTripPct: number;
  dataAgeSec: number;
  killSwitch: boolean;
  estVolPct?: number; // gate 14 — estimated position volatility (% per period) for parametric VaR
  anchorDeviationPct?: number; // gate 15 — how far the real-stock anchor deviates (oracle sanity)
  config?: GateConfig;
}

export interface GateResult {
  gate: string;
  passed: boolean;
  detail: string;
}
export interface GateReport {
  passed: boolean;
  results: GateResult[];
}

export function preTradeGates(p: Proposal, ctx: PreTradeCtx): GateReport {
  const c = ctx.config ?? DEFAULT_GATES;
  const results: GateResult[] = [];
  const add = (gate: string, passed: boolean, detail: string) => results.push({ gate, passed, detail });

  add("12_kill_switch", !ctx.killSwitch, ctx.killSwitch ? "kill switch engaged" : "ok");
  add("11_stale_data", ctx.dataAgeSec <= c.staleSec, `dataAge=${ctx.dataAgeSec}s (max ${c.staleSec})`);
  add(
    "1_max_position",
    ctx.existingTickerPct + p.sizePct <= c.maxPositionPct + 1e-9,
    `${(ctx.existingTickerPct + p.sizePct).toFixed(1)}% (max ${c.maxPositionPct})`
  );
  add(
    "2_max_gross",
    ctx.grossPct + p.sizePct <= c.maxGrossPct + 1e-9,
    `${(ctx.grossPct + p.sizePct).toFixed(1)}% (max ${c.maxGrossPct})`
  );
  add(
    "3_depeg",
    ctx.pegState !== "DISLOCATED" || p.isBasisArb === true,
    `state=${ctx.pegState} basisArb=${!!p.isBasisArb}`
  );
  add("4_liquidity", ctx.estSlippagePct <= c.maxSlippagePct + 1e-9, `slip=${ctx.estSlippagePct}% (max ${c.maxSlippagePct})`);
  add(
    "5_event_confidence",
    ctx.eventConfidence >= c.minConfidence && ctx.numericGroundingPassed,
    `conf=${ctx.eventConfidence} grounded=${ctx.numericGroundingPassed}`
  );
  add("6_leverage", p.effectiveLeverage <= c.maxLeverage + 1e-9, `lev=${p.effectiveLeverage} (max ${c.maxLeverage})`);
  add("7_correlation", ctx.correlatedOpenCount <= c.maxCorrelated, `correlated=${ctx.correlatedOpenCount} (max ${c.maxCorrelated})`);
  const netEdge = p.expectedEdgePct - ctx.feeRoundTripPct - ctx.estSlippagePct;
  add(
    "13_net_edge",
    netEdge >= (c.netEdgeMarginPct ?? 0) - 1e-9,
    `netEdge=${netEdge.toFixed(3)}% (edge ${p.expectedEdgePct} − fee ${ctx.feeRoundTripPct} − slip ${ctx.estSlippagePct}; margin ${c.netEdgeMarginPct ?? 0}%)`
  );
  // 14 — parametric 95% Value-at-Risk of the position as a % of equity (size × vol × z), capped.
  const varPct = (p.sizePct / 100) * (ctx.estVolPct ?? 0) * 1.645;
  add("14_var", varPct <= (c.maxPositionVarPct ?? Infinity) + 1e-9, `VaR95=${varPct.toFixed(3)}% (max ${c.maxPositionVarPct ?? "∞"}%)`);
  // 15 — oracle sanity: an anchor implying an absurd deviation is almost always a bad/stale/unadjusted
  // print (split, halt, feed glitch), not a real gap — refuse to certify a trade on it.
  add(
    "15_oracle_deviation",
    Math.abs(ctx.anchorDeviationPct ?? 0) <= (c.maxAnchorDeviationPct ?? Infinity) + 1e-9,
    `anchorDev=${Math.abs(ctx.anchorDeviationPct ?? 0).toFixed(2)}% (max ${c.maxAnchorDeviationPct ?? "∞"}%)`
  );

  return { passed: results.every((r) => r.passed), results };
}

export type LiveActionType =
  | "stop_loss"
  | "daily_drawdown_flatten"
  | "flat_by_open"
  | "stale_halt"
  | "kill_flatten";
export interface LiveAction {
  type: LiveActionType;
  ticker?: string;
  reason: string;
}
export interface LivePosition {
  ticker: string;
  side: "buy" | "sell";
  entry: number;
  stop?: number;
  mark: number;
}
export interface LiveCtx {
  positions: LivePosition[];
  dailyPnlPct: number;
  isPreOpenCutoff: boolean; // 09:25 ET reached
  dataAgeSec: number;
  killSwitch: boolean;
  config?: GateConfig;
}

export function liveGates(ctx: LiveCtx): LiveAction[] {
  const c = ctx.config ?? DEFAULT_GATES;
  const actions: LiveAction[] = [];

  if (ctx.killSwitch) return [{ type: "kill_flatten", reason: "kill switch engaged" }];
  if (ctx.dailyPnlPct <= -c.maxDailyDrawdownPct)
    return [{ type: "daily_drawdown_flatten", reason: `daily PnL ${ctx.dailyPnlPct.toFixed(2)}% <= -${c.maxDailyDrawdownPct}%` }];

  if (ctx.isPreOpenCutoff) {
    for (const p of ctx.positions) actions.push({ type: "flat_by_open", ticker: p.ticker, reason: "09:25 ET flat-by-open cutoff" });
  }
  for (const p of ctx.positions) {
    if (p.stop == null) continue;
    const hit = p.side === "buy" ? p.mark <= p.stop : p.mark >= p.stop;
    if (hit) actions.push({ type: "stop_loss", ticker: p.ticker, reason: `stop ${p.stop} hit @ ${p.mark}` });
  }
  if (ctx.dataAgeSec > c.staleSec) actions.push({ type: "stale_halt", reason: `data age ${ctx.dataAgeSec}s > ${c.staleSec}s` });

  return actions;
}
