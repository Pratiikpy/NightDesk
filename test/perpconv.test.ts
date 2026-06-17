import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPerpSeries, perpConvergence, perpConvergenceBacktest } from "../src/history/perpconv";

test("buildPerpSeries aligns perp to fair-value oracle and computes deviation", () => {
  const perp = [{ ts: 1, close: 103 }, { ts: 2, close: 100 }];
  const r = [{ ts: 1, close: 100 }, { ts: 2, close: 100 }];
  const s = buildPerpSeries(perp, r);
  assert.equal(s.length, 2);
  assert.ok(Math.abs(s[0].deviationPct - 3) < 1e-9);
  assert.equal(s[1].deviationPct, 0);
});

test("perpConvergence counts deviations that narrowed", () => {
  const s = [
    { ts: 1, perpClose: 103, fairValue: 100, deviationPct: 3 },
    { ts: 2, perpClose: 100.5, fairValue: 100, deviationPct: 0.5 },
  ];
  const c = perpConvergence(s, 1.0, 1);
  assert.equal(c.events, 1);
  assert.equal(c.captured, 1);
  assert.equal(c.ratePct, 100);
});

test("perpConvergenceBacktest shorts a rich perp and profits as it falls to fair value", () => {
  // perp 3% rich → SHORT at 103; converges to 100 (deviation 0 ≤ exit) → +~2.91% gross, minus fee
  const s = [
    { ts: 1, perpClose: 103, fairValue: 100, deviationPct: 3 },
    { ts: 2, perpClose: 100, fairValue: 100, deviationPct: 0 },
  ];
  const r = perpConvergenceBacktest(s, 1.0, 0.3, 0.06);
  assert.equal(r.trades, 1);
  assert.equal(r.wins, 1);
  assert.ok(r.totalPnlPct > 2.8 && r.totalPnlPct < 3.0);
});

test("perpConvergenceBacktest longs a cheap perp and profits as it rises", () => {
  const s = [
    { ts: 1, perpClose: 97, fairValue: 100, deviationPct: -3 },
    { ts: 2, perpClose: 100, fairValue: 100, deviationPct: 0 },
  ];
  const r = perpConvergenceBacktest(s, 1.0, 0.3, 0.06);
  assert.equal(r.trades, 1);
  assert.ok(r.totalPnlPct > 3.0); // (100-97)/97 = 3.09% gross - fee
});

test("perpConvergenceBacktest takes no trade when never stretched", () => {
  const s = [
    { ts: 1, perpClose: 100.2, fairValue: 100, deviationPct: 0.2 },
    { ts: 2, perpClose: 100, fairValue: 100, deviationPct: 0 },
  ];
  assert.equal(perpConvergenceBacktest(s, 1.0, 0.3, 0.06).trades, 0);
});
