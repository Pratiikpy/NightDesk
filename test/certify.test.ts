import { test } from "node:test";
import assert from "node:assert/strict";
import { certifyToken } from "../src/research/certify";
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

test("certify: a normal token is FAIR / NORMAL with a high safety score", () => {
  const t = certifyToken(row({ premiumVsEquityPct: 0.1, stateVsEquity: "NORMAL" }), ctx({}), "A");
  assert.equal(t.classification, "FAIR");
  assert.equal(t.policy, "NORMAL");
  assert.ok(t.safetyScore >= 80);
});

test("certify: a cheap dislocation with no news → MISPRICED / LONG-ONLY FADE", () => {
  const t = certifyToken(row({ premiumVsEquityPct: -2.5, stateVsEquity: "DISLOCATED", premiumPct: -0.1 }), ctx({}), "B");
  assert.equal(t.classification, "MISPRICED");
  assert.equal(t.policy, "LONG-ONLY FADE");
});

test("certify: a rich dislocation → MISPRICED / WATCH (not cleanly shortable)", () => {
  const t = certifyToken(row({ premiumVsEquityPct: 2.5, stateVsEquity: "DISLOCATED", premiumPct: 0.1 }), ctx({}), "B");
  assert.equal(t.policy, "WATCH");
});

test("certify: a fresh news catalyst → NEWS-DRIVEN / ABSTAIN, lower safety", () => {
  const t = certifyToken(
    row({ premiumVsEquityPct: -2.5, stateVsEquity: "DISLOCATED" }),
    ctx({ news: { fresh: true, count: 1, relevantCount: 1, matched: ["earnings"], latestTitle: "x", summary: "catalyst" } }),
    "A"
  );
  assert.equal(t.classification, "NEWS-DRIVEN");
  assert.equal(t.policy, "ABSTAIN");
});
