import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mulberry32,
  latencyFor,
  arrivalTs,
  quantizeToTick,
  applySlippage,
  fillPriceAtOrAfter,
  runLatencySweep,
} from "../src/execution/latency-slippage";

test("mulberry32 is deterministic per seed and varies across seeds", () => {
  const a = mulberry32(1);
  const b = mulberry32(1);
  assert.equal(a(), b()); // same seed -> same sequence
  assert.equal(a(), b());
  const c = mulberry32(2);
  assert.notEqual(mulberry32(1)(), c()); // different seed -> different first draw
  // draws are in [0,1)
  const r = mulberry32(99);
  for (let i = 0; i < 50; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test("latencyFor composes base + per-operation latency", () => {
  const m = { baseMs: 10, insertMs: 5, updateMs: 3, deleteMs: 8 };
  assert.equal(latencyFor(m, "insert"), 15);
  assert.equal(latencyFor(m, "update"), 13);
  assert.equal(latencyFor(m, "delete"), 18);
  assert.equal(arrivalTs(1000, m, "insert"), 1015);
});

test("quantizeToTick rounds to the nearest tick", () => {
  assert.equal(quantizeToTick(100.123, 0.01), 100.12);
  assert.equal(quantizeToTick(100.126, 0.01), 100.13);
  assert.equal(quantizeToTick(100.0, 0.01), 100.0);
});

test("applySlippage never slips when probability is 0", () => {
  const rng = mulberry32(7);
  const px = applySlippage(100, "buy", { tickSize: 0.01, slipProbability: 0, maxTicks: 3 }, rng);
  assert.equal(px, 100);
});

test("applySlippage moves price against the side when it slips", () => {
  const buy = applySlippage(100, "buy", { tickSize: 0.01, slipProbability: 1, maxTicks: 3 }, mulberry32(3));
  assert.ok(buy > 100, `buy slips up: ${buy}`);
  const sell = applySlippage(100, "sell", { tickSize: 0.01, slipProbability: 1, maxTicks: 3 }, mulberry32(3));
  assert.ok(sell < 100, `sell slips down: ${sell}`);
  // deterministic: same seed + inputs -> identical result
  assert.equal(
    applySlippage(100, "buy", { tickSize: 0.01, slipProbability: 1, maxTicks: 3 }, mulberry32(11)),
    applySlippage(100, "buy", { tickSize: 0.01, slipProbability: 1, maxTicks: 3 }, mulberry32(11)),
  );
});

test("fillPriceAtOrAfter returns the first price at or after a time", () => {
  const path = [
    { ms: 0, price: 100 },
    { ms: 10, price: 101 },
    { ms: 20, price: 102 },
  ];
  assert.equal(fillPriceAtOrAfter(path, 0), 100);
  assert.equal(fillPriceAtOrAfter(path, 5), 101);
  assert.equal(fillPriceAtOrAfter(path, 20), 102);
  assert.equal(fillPriceAtOrAfter(path, 999), 102); // clamps to last
});

test("latency sweep: raw fill price is non-decreasing as latency grows on a rising path", () => {
  const rows = runLatencySweep({ latencies: [0, 50, 250] });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].latencyMs, 0);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].rawFillPrice >= rows[i - 1].rawFillPrice, "raw fill should worsen (rise) with latency");
  }
  // determinism: identical inputs reproduce identical rows
  assert.deepEqual(runLatencySweep({ latencies: [0, 50, 250] }), rows);
});
