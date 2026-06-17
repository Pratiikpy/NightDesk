import { test } from "node:test";
import assert from "node:assert/strict";
import { preTradeGates, liveGates, DEFAULT_GATES, type Proposal, type PreTradeCtx, type LiveCtx } from "../src/gates/gates";

const baseProposal: Proposal = {
  ticker: "NVDA",
  instrument: "perp",
  side: "buy",
  sizePct: 5,
  expectedEdgePct: 1.0,
  effectiveLeverage: 2,
  stop: 200,
  isBasisArb: false,
};
const baseCtx: PreTradeCtx = {
  existingTickerPct: 0,
  grossPct: 10,
  pegState: "STRETCHED",
  estSlippagePct: 0.1,
  eventConfidence: 0.8,
  numericGroundingPassed: true,
  correlatedOpenCount: 0,
  feeRoundTripPct: 0.32,
  dataAgeSec: 5,
  killSwitch: false,
  estVolPct: 1.0,
  anchorDeviationPct: 1.0,
};

test("a sound proposal passes all pre-trade gates", () => {
  const rep = preTradeGates(baseProposal, baseCtx);
  assert.equal(rep.passed, true, JSON.stringify(rep.results.filter((r) => !r.passed)));
  assert.equal(rep.results.length, 12);
});

test("VaR gate blocks an oversized, high-volatility position", () => {
  const rep = preTradeGates({ ...baseProposal, sizePct: 10 }, { ...baseCtx, estVolPct: 10 }); // VaR≈1.65% > 1.5%
  assert.equal(rep.results.find((r) => r.gate === "14_var")!.passed, false);
});

test("oracle-deviation gate blocks an implausible anchor (likely a bad/stale print)", () => {
  const rep = preTradeGates(baseProposal, { ...baseCtx, anchorDeviationPct: 40 }); // 40% ⇒ split/bad print
  assert.equal(rep.results.find((r) => r.gate === "15_oracle_deviation")!.passed, false);
});

test("max-position gate blocks oversize", () => {
  const rep = preTradeGates({ ...baseProposal, sizePct: 8 }, { ...baseCtx, existingTickerPct: 5 });
  assert.equal(rep.passed, false);
  assert.equal(rep.results.find((r) => r.gate === "1_max_position")!.passed, false);
});

test("depeg gate blocks DISLOCATED unless basis-arb", () => {
  const blocked = preTradeGates(baseProposal, { ...baseCtx, pegState: "DISLOCATED" });
  assert.equal(blocked.results.find((r) => r.gate === "3_depeg")!.passed, false);
  const allowed = preTradeGates({ ...baseProposal, isBasisArb: true }, { ...baseCtx, pegState: "DISLOCATED" });
  assert.equal(allowed.results.find((r) => r.gate === "3_depeg")!.passed, true);
});

test("net-edge gate blocks edge below round-trip cost", () => {
  const rep = preTradeGates({ ...baseProposal, expectedEdgePct: 0.2 }, baseCtx);
  assert.equal(rep.results.find((r) => r.gate === "13_net_edge")!.passed, false);
});

test("net-edge gate is cost-AWARE: edge clears the fee but not fee+slippage → blocked", () => {
  // edge 0.4 > fee 0.32 (the old fee gate would pass), but 0.4 − 0.32 − 0.2 = −0.12 < 0 → blocked.
  const rep = preTradeGates({ ...baseProposal, expectedEdgePct: 0.4 }, { ...baseCtx, estSlippagePct: 0.2 });
  assert.equal(rep.results.find((r) => r.gate === "13_net_edge")!.passed, false);
});

test("net-edge gate respects a positive margin", () => {
  // edge 0.5 − fee 0.32 − slip 0.1 = 0.08; with a 0.2% margin requirement → blocked.
  const rep = preTradeGates(
    { ...baseProposal, expectedEdgePct: 0.5 },
    { ...baseCtx, estSlippagePct: 0.1, config: { ...DEFAULT_GATES, netEdgeMarginPct: 0.2 } }
  );
  assert.equal(rep.results.find((r) => r.gate === "13_net_edge")!.passed, false);
});

test("leverage, liquidity, confidence, correlation, stale, kill gates each fail when violated", () => {
  assert.equal(preTradeGates({ ...baseProposal, effectiveLeverage: 5 }, baseCtx).results.find((r) => r.gate === "6_leverage")!.passed, false);
  assert.equal(preTradeGates(baseProposal, { ...baseCtx, estSlippagePct: 0.9 }).results.find((r) => r.gate === "4_liquidity")!.passed, false);
  assert.equal(preTradeGates(baseProposal, { ...baseCtx, eventConfidence: 0.3 }).results.find((r) => r.gate === "5_event_confidence")!.passed, false);
  assert.equal(preTradeGates(baseProposal, { ...baseCtx, numericGroundingPassed: false }).results.find((r) => r.gate === "5_event_confidence")!.passed, false);
  assert.equal(preTradeGates(baseProposal, { ...baseCtx, correlatedOpenCount: 3 }).results.find((r) => r.gate === "7_correlation")!.passed, false);
  assert.equal(preTradeGates(baseProposal, { ...baseCtx, dataAgeSec: 120 }).results.find((r) => r.gate === "11_stale_data")!.passed, false);
  assert.equal(preTradeGates(baseProposal, { ...baseCtx, killSwitch: true }).results.find((r) => r.gate === "12_kill_switch")!.passed, false);
});

test("live gates: stop-loss fires on a long when mark <= stop", () => {
  const ctx: LiveCtx = {
    positions: [{ ticker: "NVDA", side: "buy", entry: 210, stop: 200, mark: 199 }],
    dailyPnlPct: -0.5,
    isPreOpenCutoff: false,
    dataAgeSec: 5,
    killSwitch: false,
  };
  const actions = liveGates(ctx);
  assert.ok(actions.some((a) => a.type === "stop_loss" && a.ticker === "NVDA"));
});

test("live gates: daily drawdown flattens everything", () => {
  const actions = liveGates({ positions: [{ ticker: "X", side: "buy", entry: 1, mark: 1 }], dailyPnlPct: -3.5, isPreOpenCutoff: false, dataAgeSec: 1, killSwitch: false });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "daily_drawdown_flatten");
});

test("live gates: flat-by-open closes all positions at cutoff", () => {
  const actions = liveGates({
    positions: [{ ticker: "A", side: "buy", entry: 1, mark: 1 }, { ticker: "B", side: "sell", entry: 1, mark: 1 }],
    dailyPnlPct: 0,
    isPreOpenCutoff: true,
    dataAgeSec: 1,
    killSwitch: false,
  });
  assert.equal(actions.filter((a) => a.type === "flat_by_open").length, 2);
});

test("live gates: kill switch overrides everything", () => {
  const actions = liveGates({ positions: [], dailyPnlPct: 0, isPreOpenCutoff: true, dataAgeSec: 999, killSwitch: true });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "kill_flatten");
});
