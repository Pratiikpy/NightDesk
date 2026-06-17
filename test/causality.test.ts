import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyGap } from "../src/perception/causality";
import type { PegRow } from "../src/pegwatch/collect";
import type { PerceptionContext } from "../src/perception/events";

const row = (over: Partial<PegRow>): PegRow =>
  ({
    ticker: "NVDA",
    rToken: { symbol: "RNVDAUSDT", bid: 1, ask: 1, last: 1, mid: 210, ts: 1, bookLevels: 15 } as any,
    perp: { symbol: "NVDAUSDT", bid: 1, ask: 1, last: 1, mid: 210, ts: 1, funding: 0 } as any,
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

const ctx = (over: Partial<PerceptionContext>): PerceptionContext => ({
  ticker: "NVDA",
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "no recent news" },
  severity: "none",
  abstainRecommended: false,
  summary: "none",
  ...over,
});

const big = { premiumVsEquityPct: 2.5, stateVsEquity: "DISLOCATED" as const };

test("NONE when there is no actionable gap", () => {
  assert.equal(classifyGap(row({ premiumVsEquityPct: 0.1, stateVsEquity: "NORMAL" }), ctx({})).type, "NONE");
});

test("UNKNOWN + ABSTAIN when there is no real-stock anchor", () => {
  const c = classifyGap(row({ premiumVsEquityPct: null, equity: null }), ctx({}));
  assert.equal(c.type, "UNKNOWN");
  assert.equal(c.action, "ABSTAIN");
});

test("EARNINGS → ABSTAIN on a fresh earnings catalyst", () => {
  const c = classifyGap(
    row({ ...big, premiumPct: -0.1 }),
    ctx({ news: { fresh: true, count: 1, relevantCount: 1, matched: ["NVDA beats earnings"], latestTitle: "x", summary: "catalyst" } })
  );
  assert.equal(c.type, "EARNINGS");
  assert.equal(c.action, "ABSTAIN");
});

test("MACRO → ABSTAIN on a high-severity macro day", () => {
  const c = classifyGap(row({ ...big, premiumPct: -0.1 }), ctx({ macro: { active: true, date: "d", events: ["CPI"], severity: "high", summary: "CPI" } }));
  assert.equal(c.type, "MACRO");
  assert.equal(c.action, "ABSTAIN");
});

test("PERP_ILLUSION → FADE when the true gap is real but the perp barely shows it", () => {
  const c = classifyGap(row({ ...big, premiumPct: -0.12 }), ctx({}));
  assert.equal(c.type, "PERP_ILLUSION");
  assert.equal(c.action, "FADE");
});

test("ISSUER → AVOID when the three legs disagree", () => {
  const c = classifyGap(
    row({ ...big, premiumPct: 1.0, triangulation: { rPerpPct: 1, ondoPerpPct: -1, rOndoPct: 2, maxDisagreementPct: 2, flagged: true } as any }),
    ctx({})
  );
  assert.equal(c.type, "ISSUER");
  assert.equal(c.action, "AVOID");
});

test("NOISE → FADE when a gap shows on both anchors with no catalyst", () => {
  const c = classifyGap(row({ ...big, premiumPct: 1.5 }), ctx({}));
  assert.equal(c.type, "NOISE");
  assert.equal(c.action, "FADE");
});
