import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  stddev,
  sharpe,
  sortino,
  maxDrawdown,
  equityCurve,
  profitFactor,
  expectancy,
  winRate,
  calmar,
  summarizePerformance,
  MIN_RELIABLE_N,
} from "../src/research/performance-stats";

const approx = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ~= ${b}`);

test("mean and sample stddev match hand-computed values", () => {
  approx(mean([1, 2, 3, 4]), 2.5);
  // sample variance of [2,4,6] = 8/(3-1) = 4 -> sd = 2
  approx(stddev([2, 4, 6]), 2);
  assert.equal(stddev([5]), 0); // fewer than 2 points
});

test("maxDrawdown is the largest peak-to-trough fraction", () => {
  approx(maxDrawdown([100, 120, 90, 110]), (120 - 90) / 120); // 0.25
  approx(maxDrawdown([100, 101, 102]), 0); // monotonic up
});

test("equityCurve compounds PnL from the starting balance", () => {
  assert.deepEqual(equityCurve(1000, [10, -5, 20]), [1000, 1010, 1005, 1025]);
});

test("profitFactor = gross profit / gross loss, with edge cases", () => {
  approx(profitFactor([10, -5, 5, -5]), 15 / 10); // 1.5
  assert.equal(profitFactor([10, 5]), Infinity); // wins, no losses
  assert.equal(profitFactor([0, 0]), 0); // nothing decided
});

test("winRate ignores exact-zero scratches", () => {
  approx(winRate([10, -5, 5, -5]), 0.5); // 2 wins of 4 decided
  approx(winRate([10, 0, 0, 10]), 1); // zeros excluded
  assert.equal(winRate([0, 0]), 0);
});

test("expectancy is the average PnL per trade", () => {
  approx(expectancy([10, -5, 5, -5]), 1.25);
});

test("sharpe and sortino are zero when undefined, positive for a good series", () => {
  assert.equal(sharpe([]), 0);
  assert.equal(sharpe([0.01, 0.01, 0.01]), 0); // zero variance -> guarded to 0
  assert.ok(sharpe([0.02, 0.01, 0.03, -0.01]) > 0);
  assert.ok(sortino([0.02, 0.01, 0.03, -0.01]) > 0);
  // sortino >= sharpe when there is upside dispersion (downside dev <= total dev here)
  assert.ok(sortino([0.05, 0.04, -0.01]) >= sharpe([0.05, 0.04, -0.01]));
});

test("calmar = total return / max drawdown, zero when no drawdown", () => {
  approx(calmar(0.2, 0.25), 0.8);
  assert.equal(calmar(0.2, 0), 0);
});

test("summarizePerformance flags small samples as not reliable and large ones as reliable", () => {
  const thin = summarizePerformance([10, -5, 20], 1000);
  assert.equal(thin.n, 3);
  assert.equal(thin.reliable, false);
  assert.match(thin.reliabilityNote, /not yet statistically reliable/i);
  approx(thin.totalPnl, 25);
  approx(thin.totalReturnPct, 2.5);

  const deep = summarizePerformance(Array.from({ length: MIN_RELIABLE_N }, (_, i) => (i % 2 === 0 ? 5 : -2)), 1000);
  assert.equal(deep.n, MIN_RELIABLE_N);
  assert.equal(deep.reliable, true);
  assert.match(deep.reliabilityNote, /interpretable/i);
});

test("summarizePerformance encodes infinite profit factor as null for clean JSON", () => {
  const s = summarizePerformance([10, 20, 30], 1000); // all wins
  assert.equal(s.profitFactor, null);
  assert.equal(s.wins, 3);
  assert.equal(s.losses, 0);
});
