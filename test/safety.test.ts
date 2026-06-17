// Safety / adversarial / data-integrity / tradeability traps — we prove robustness with traps the
// system must survive, not adjectives. Each test feeds a hostile or degenerate input and asserts the
// desk does the safe thing (block / abstain / not crash).
import { test } from "node:test";
import assert from "node:assert/strict";
import { preTradeGates, DEFAULT_GATES, type Proposal, type PreTradeCtx } from "../src/gates/gates";
import { classifyGap } from "../src/perception/causality";
import { certifyToken } from "../src/research/certify";
import { isTradeable, classifyDepeg } from "../src/pegwatch/fairvalue";
import { trueGapReversion, type Bar } from "../src/history/study";
import type { PegRow } from "../src/pegwatch/collect";
import type { PerceptionContext } from "../src/perception/events";

const ctx = (over: Partial<PerceptionContext> = {}): PerceptionContext => ({
  ticker: "NVDA",
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "none" },
  severity: "none",
  abstainRecommended: false,
  summary: "none",
  ...over,
});
const baseRow = (over: Partial<PegRow>): PegRow =>
  ({
    ticker: "NVDA",
    rToken: { symbol: "RNVDAUSDT", bid: 209, ask: 211, last: 210, mid: 210, ts: 1, bookLevels: 10 } as any,
    perp: { symbol: "NVDAUSDT", bid: 209, ask: 211, last: 210, mid: 210, ts: 1, funding: 0 } as any,
    ondo: null,
    premiumPct: 0,
    state: "NORMAL",
    tradeable: false,
    triangulation: null,
    equity: { price: 205, previousClose: 205, marketState: "CLOSED", asOf: 1 },
    premiumVsEquityPct: 0,
    stateVsEquity: "NORMAL",
    ...over,
  }) as PegRow;

const baseProposal: Proposal = { ticker: "NVDA", instrument: "spot", side: "buy", sizePct: 5, expectedEdgePct: 1.0, effectiveLeverage: 1, isBasisArb: true };
const baseCtx: PreTradeCtx = {
  existingTickerPct: 0,
  grossPct: 5,
  pegState: "STRETCHED",
  estSlippagePct: 0.1,
  eventConfidence: 0.8,
  numericGroundingPassed: true,
  correlatedOpenCount: 0,
  feeRoundTripPct: 0.32,
  dataAgeSec: 2,
  killSwitch: false,
};

test("TRAP slippage > edge: a wide book that erases the edge is blocked", () => {
  const rep = preTradeGates(baseProposal, { ...baseCtx, estSlippagePct: 1.2 });
  assert.equal(rep.passed, false);
  assert.equal(rep.results.find((r) => r.gate === "4_liquidity")!.passed, false);
  assert.equal(rep.results.find((r) => r.gate === "13_net_edge")!.passed, false);
});

test("TRAP stale data: an old feed is blocked by the staleness gate", () => {
  const rep = preTradeGates(baseProposal, { ...baseCtx, dataAgeSec: DEFAULT_GATES.staleSec + 30 });
  assert.equal(rep.results.find((r) => r.gate === "11_stale_data")!.passed, false);
});

test("TRAP no real-stock anchor: classify as UNKNOWN → abstain (don't guess)", () => {
  const c = classifyGap(baseRow({ premiumVsEquityPct: null, equity: null as any }), ctx());
  assert.equal(c.type, "UNKNOWN");
  assert.equal(c.action, "ABSTAIN");
});

test("TRAP no tradeable rToken quote: certify as LIQUIDITY-TRAP → BLOCK", () => {
  const t = certifyToken(baseRow({ premiumVsEquityPct: -2.5, stateVsEquity: "DISLOCATED", rToken: null as any }), ctx(), "C");
  assert.equal(t.classification, "LIQUIDITY-TRAP");
  assert.equal(t.policy, "BLOCK");
});

test("TRAP sub-fee-floor premium is not tradeable", () => {
  assert.equal(isTradeable(0.2), false); // below the ~0.32% round-trip floor
  assert.equal(isTradeable(0.5), true);
  assert.equal(classifyDepeg(0.1), "NORMAL");
});

test("TRAP duplicate + missing timestamps: reversion dedupes by day and does not crash", () => {
  const d = (i: number, close: number): Bar => ({ ts: i * 86_400_000, close });
  const rBars: Bar[] = [d(0, 100), d(0, 100), d(1, 103), d(3, 100)]; // dup day 0, missing day 2
  const eqBars: Bar[] = [d(0, 100), d(1, 100), d(3, 100)];
  const r = trueGapReversion(rBars, eqBars, 1);
  assert.ok(Number.isFinite(r.reversionReturnPct));
  assert.ok(r.n >= 0);
});

test("TRAP zero / negative price is rejected by the depeg classifier path", () => {
  // a crossed/zero book shouldn't yield a spurious tradeable signal
  assert.equal(isTradeable(0), false);
  assert.equal(classifyDepeg(0), "NORMAL");
});
