import { test } from "node:test";
import assert from "node:assert/strict";
import { mean, stdev, sharpe, sortino, maxDrawdown, profitFactor, riskAdjusted, brierScore, reliabilityBuckets, bootstrapMeanCI } from "../src/history/metrics";

test("mean and stdev", () => {
  assert.equal(mean([2, 4]), 3);
  assert.equal(stdev([2, 4]), 1);
  assert.equal(mean([]), 0);
});

test("sharpe = mean/stdev; 0 when no dispersion", () => {
  assert.equal(sharpe([2, 1, 2, 1]), 3); // mean 1.5 / sd 0.5
  assert.equal(sharpe([1, 1, 1]), 0); // sd 0
});

test("sortino penalises only downside; Infinity when no losses", () => {
  assert.equal(sortino([1, 2, 3]), Infinity);
  assert.ok(sortino([1, 2, -1]) > 0 && Number.isFinite(sortino([1, 2, -1])));
});

test("maxDrawdown tracks the worst peak-to-trough of the cumulative curve", () => {
  assert.equal(maxDrawdown([1, 1, -3, 1]), 3); // cum 1,2,-1,0 → peak 2, trough -1 → 3
  assert.equal(maxDrawdown([1, 2, 3]), 0); // monotonic up
});

test("profitFactor = gross wins / gross losses", () => {
  assert.equal(profitFactor([2, -1, 1]), 3);
  assert.equal(profitFactor([1, 2]), Infinity);
});

test("riskAdjusted bundles the stack", () => {
  const r = riskAdjusted([2, -1, 1, -0.5]);
  assert.equal(r.trades, 4);
  assert.ok(Number.isFinite(r.sharpe));
  assert.ok(r.maxDrawdownPct >= 0);
});

test("brierScore: 0 perfect, 0.25 always-50%, 1 confidently wrong", () => {
  assert.equal(brierScore([{ p: 1, outcome: 1 }, { p: 0, outcome: 0 }]), 0);
  assert.equal(brierScore([{ p: 0.5, outcome: 1 }, { p: 0.5, outcome: 0 }]), 0.25);
  assert.equal(brierScore([{ p: 1, outcome: 0 }]), 1);
  assert.equal(brierScore([]), 0);
});

test("reliabilityBuckets group predictions and compare predicted vs actual", () => {
  const b = reliabilityBuckets([{ p: 0.1, outcome: 0 }, { p: 0.1, outcome: 0 }, { p: 0.9, outcome: 1 }], 5);
  assert.equal(b.length, 5);
  assert.equal(b[0]!.n, 2);
  assert.equal(b[0]!.actualRate, 0);
  assert.equal(b[4]!.n, 1);
  assert.equal(b[4]!.actualRate, 1);
});


test("bootstrapMeanCI: a clearly positive sample yields a CI that excludes 0", () => {
  const s = Array.from({ length: 60 }, (_, i) => 1 + (i % 5) * 0.1); // all positive, mean ~1.2
  const ci = bootstrapMeanCI(s);
  assert.equal(ci.n, 60);
  assert.ok(ci.lo > 0, `lo should be > 0, got ${ci.lo}`);
  assert.equal(ci.excludesZero, true);
});

test("bootstrapMeanCI: a symmetric zero-mean sample straddles 0", () => {
  const s: number[] = [];
  for (let i = 0; i < 50; i++) s.push(i % 2 === 0 ? 1 : -1); // mean 0
  const ci = bootstrapMeanCI(s);
  assert.ok(ci.lo < 0 && ci.hi > 0, `CI should straddle 0, got [${ci.lo}, ${ci.hi}]`);
  assert.equal(ci.excludesZero, false);
});

test("bootstrapMeanCI is deterministic (seeded)", () => {
  const s = [0.5, -0.2, 1.1, -0.7, 0.3, 0.9, -0.1, 0.4];
  assert.deepEqual(bootstrapMeanCI(s), bootstrapMeanCI(s));
});

test("bootstrapMeanCI: empty sample is safe", () => {
  assert.deepEqual(bootstrapMeanCI([]), { n: 0, mean: 0, lo: 0, hi: 0, excludesZero: false });
});
