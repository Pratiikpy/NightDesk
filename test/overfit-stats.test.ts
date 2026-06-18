import { test } from "node:test";
import assert from "node:assert/strict";
import {
  erf,
  normCdf,
  normInv,
  skewness,
  kurtosis,
  seriesSharpe,
  expectedMaxSharpe,
  probabilisticSharpe,
  minTrackRecordLength,
  probabilityOfBacktestOverfitting,
  computeOverfitStats,
  buildOverfitInputs,
  formatOverfitMarkdown,
} from "../src/research/overfit-stats";

const approx = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ~= ${b}`);

test("normCdf matches known quantiles", () => {
  approx(normCdf(0), 0.5);
  approx(normCdf(1.959964), 0.975, 1e-3);
  approx(normCdf(-1.959964), 0.025, 1e-3);
  approx(erf(0), 0);
});

test("normInv is the inverse of normCdf (round-trip)", () => {
  for (const x of [-2.3, -1, -0.2, 0.5, 1.4, 2.7]) approx(normInv(normCdf(x)), x, 1e-3);
  approx(normInv(0.975), 1.959964, 1e-3);
  assert.equal(normInv(0), -Infinity);
  assert.equal(normInv(1), Infinity);
});

test("skewness and kurtosis: symmetric normal-ish vs skewed", () => {
  const sym = [-2, -1, 0, 1, 2];
  approx(skewness(sym), 0, 1e-9);
  const rightSkew = [0, 0, 0, 0, 10];
  assert.ok(skewness(rightSkew) > 0, "right-skewed sample has positive skew");
  assert.ok(kurtosis([1, 1, 1, 1, 9]) > 1, "kurtosis is positive");
});

test("expectedMaxSharpe grows with the number of trials", () => {
  assert.equal(expectedMaxSharpe(0.25, 1), 0, "N<2 returns 0");
  const a = expectedMaxSharpe(0.25, 10);
  const b = expectedMaxSharpe(0.25, 10000);
  assert.ok(b > a && a > 0, `more trials -> higher luck bar (${a} < ${b})`);
  assert.ok(expectedMaxSharpe(1, 100) > expectedMaxSharpe(0.25, 100), "more dispersion -> higher bar");
});

test("probabilisticSharpe rises with Sharpe and with sample length", () => {
  const base = probabilisticSharpe(0.5, 0, 20, 0, 3);
  assert.ok(probabilisticSharpe(1.0, 0, 20, 0, 3) > base, "higher Sharpe -> higher PSR");
  assert.ok(probabilisticSharpe(0.5, 0, 200, 0, 3) > base, "longer record -> higher PSR");
  assert.ok(base > 0 && base < 1, "PSR is a probability");
});

test("deflated Sharpe is never easier than PSR-vs-zero", () => {
  // Deflating against a positive expected-max benchmark can only lower the probability.
  const psr0 = probabilisticSharpe(1.2, 0, 30, 0, 3);
  const dsr = probabilisticSharpe(1.2, expectedMaxSharpe(0.3, 5000), 30, 0, 3);
  assert.ok(dsr <= psr0, `DSR (${dsr}) <= PSR0 (${psr0})`);
});

test("minTrackRecordLength: positive when SR>0, null when SR<=0", () => {
  const n = minTrackRecordLength(0.5, 0, 0, 3, 0.95);
  assert.ok(n != null && n > 0, "needs a positive number of observations");
  assert.equal(minTrackRecordLength(0, 0, 0, 3), null, "no edge -> unreachable");
  assert.equal(minTrackRecordLength(-0.4, 0, 0, 3), null, "negative edge -> unreachable");
  // A smaller edge requires a longer record.
  assert.ok(minTrackRecordLength(0.2, 0, 0, 3)! > minTrackRecordLength(0.8, 0, 0, 3)!);
});

test("PBO gates on too few slices, returns a probability otherwise", () => {
  const small = probabilityOfBacktestOverfitting([[1, 2, 3], [3, 2, 1]]);
  assert.equal(small.status, "insufficient_slices");
  assert.equal(small.value, null);

  // One config dominates every slice -> always in-sample-best AND out-of-sample-best -> PBO 0.
  const slices = 8;
  const dominant = Array.from({ length: slices }, () => 100);
  const weak = [Array.from({ length: slices }, () => -1), Array.from({ length: slices }, () => -2)];
  const skilled = probabilityOfBacktestOverfitting([dominant, ...weak]);
  assert.equal(skilled.status, "computed");
  assert.equal(skilled.value, 0, "a genuinely dominant config is not overfit");
  assert.equal(skilled.combinations, 70, "C(8,4) = 70 balanced splits");

  // A config that wins the first half but loses the second half is the classic overfit pattern.
  const a = [10, 10, 10, 10, -10, -10, -10, -10];
  const b = [-1, -1, -1, -1, 1, 1, 1, 1];
  const overfit = probabilityOfBacktestOverfitting([a, b]);
  assert.ok(overfit.value! > 0 && overfit.value! <= 1, `flip-flop config shows overfitting (${overfit.value})`);
});

test("computeOverfitStats end-to-end shape and honesty on a small sample", () => {
  const stats = computeOverfitStats({
    championPnls: [12, -4, 8, 3, -2],
    nTrials: 9720,
    trialSharpes: [0.4, -0.3, 0.9, -0.6, 0.1, 0.7, -0.2],
  });
  assert.equal(stats.nTrials, 9720);
  assert.equal(stats.nObservations, 5);
  assert.ok(stats.deflatedSharpe >= 0 && stats.deflatedSharpe <= 1, "DSR is a probability");
  assert.ok(stats.deflatedSharpe <= stats.probabilisticSharpeVsZero + 1e-9, "deflation never inflates");
  assert.ok(stats.expectedMaxSharpe > 0, "9720 trials set a real luck bar");
  // 5 sessions cannot prove significance after deflating for ~9720 trials.
  assert.equal(stats.deflatedSharpeSignificant, false);
  assert.equal(stats.pbo.status, "insufficient_slices", "5 sessions < 8 slices");
  assert.ok(/Deflated Sharpe/.test(stats.verdict));
  assert.ok(formatOverfitMarkdown(stats).includes("Selection-Bias Controls"));
});

test("buildOverfitInputs reshapes a flat registry into a balanced grid", () => {
  const rows = [
    { config_id: "a", recording: "d1", net_pnl: 5 },
    { config_id: "a", recording: "d2", net_pnl: -3 },
    { config_id: "b", recording: "d1", net_pnl: 0 },
    { config_id: "b", recording: "d2", net_pnl: 0 },
    { config_id: "c", recording: "d1", net_pnl: 2 },
    // c is missing d2 -> excluded from the PBO matrix
  ];
  const input = buildOverfitInputs(rows, [5, -3]);
  assert.equal(input.nTrials, 3, "three distinct configs were searched");
  assert.equal(input.pboMatrix!.length, 2, "only configs present on every recording enter the matrix");
  // 'b' is a flat zero series -> contributes no Sharpe; 'a' does.
  assert.ok(input.trialSharpes.length >= 1);
});
