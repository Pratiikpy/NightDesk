import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPremiumSeries,
  convergenceCapture,
  pegTrackingError,
  basisBacktest,
  randomBaseline,
  convergenceCaptureShuffled,
  clairvoyantBound,
  trueGapReversion,
  gapReversionBuckets,
  mulberry32,
  type Bar,
  type PremiumPoint,
} from "../src/history/study";

const ppt = (ts: number, premiumPct: number): PremiumPoint => ({ ts, rClose: 100 + premiumPct, perpClose: 100, premiumPct });

test("buildPremiumSeries aligns by timestamp and computes premium", () => {
  const r: Bar[] = [{ ts: 1, close: 99 }, { ts: 2, close: 101 }, { ts: 3, close: 100 }];
  const p: Bar[] = [{ ts: 1, close: 100 }, { ts: 2, close: 100 }]; // ts=3 missing on perp
  const s = buildPremiumSeries(r, p);
  assert.equal(s.length, 2);
  assert.ok(Math.abs(s[0].premiumPct - -1) < 1e-9);
  assert.ok(Math.abs(s[1].premiumPct - 1) < 1e-9);
});

test("convergenceCapture counts stretches that narrowed", () => {
  // premiums: -2 (stretch), then -0.5 (narrowed) → captured
  const series = [
    { ts: 1, rClose: 98, perpClose: 100, premiumPct: -2 },
    { ts: 2, rClose: 99.5, perpClose: 100, premiumPct: -0.5 },
  ];
  const c = convergenceCapture(series, 1.0, 1);
  assert.equal(c.events, 1);
  assert.equal(c.captured, 1);
  assert.equal(c.ratePct, 100);
  assert.ok(c.avgNarrowingPct > 0);
});

test("convergenceCapture ignores points below the stretch threshold", () => {
  const series = [
    { ts: 1, rClose: 100, perpClose: 100, premiumPct: 0.2 },
    { ts: 2, rClose: 100, perpClose: 100, premiumPct: 0.1 },
  ];
  assert.equal(convergenceCapture(series, 1.0, 1).events, 0);
});

test("pegTrackingError rewards the perp anchor when rToken reverts toward it", () => {
  // rToken dips to 98 then reverts to 100 (the perp level). perp predicts the future (100) perfectly;
  // last-close (98) is off by 2.
  const series = [
    { ts: 1, rClose: 98, perpClose: 100, premiumPct: -2 },
    { ts: 2, rClose: 100, perpClose: 100, premiumPct: 0 },
  ];
  const t = pegTrackingError(series, 1);
  assert.equal(t.n, 1);
  assert.equal(t.modelMAE, 0); // perp(98-row)=100 == future 100
  assert.equal(t.baselineMAE, 2); // rToken(98) vs future 100
  assert.ok(t.improvementPct > 99);
});

test("basisBacktest captures a converging gap net of fees", () => {
  // enter long-basis at premium -1.5%, exit at -0.2% → gross +1.3pp, minus 0.5 fee = +0.8
  const series = [
    { ts: 1, rClose: 985, perpClose: 1000, premiumPct: -1.5 },
    { ts: 2, rClose: 998, perpClose: 1000, premiumPct: -0.2 },
  ];
  const b = basisBacktest(series, 1.0, 0.3, 0.5);
  assert.equal(b.trades, 1);
  assert.equal(b.wins, 1);
  assert.ok(Math.abs(b.totalPnlPct - 0.8) < 1e-9);
});

test("basisBacktest takes no trade when premium never reaches entry", () => {
  const series = [
    { ts: 1, rClose: 999, perpClose: 1000, premiumPct: -0.1 },
    { ts: 2, rClose: 1000, perpClose: 1000, premiumPct: 0 },
  ];
  assert.equal(basisBacktest(series, 1.0, 0.3, 0.5).trades, 0);
});

test("basisBacktest is survivorship-free: a non-converging position is counted as a loss", () => {
  // opens a long-basis at -2% and never reverts → must be marked-to-end and counted, NOT dropped
  const series: PremiumPoint[] = [
    { ts: 1, rClose: 980, perpClose: 1000, premiumPct: -2 },
    { ts: 2, rClose: 980, perpClose: 1000, premiumPct: -2 },
  ];
  const b = basisBacktest(series, 1.0, 0.3, 0.5); // default maxHold=Infinity → end-of-series close
  assert.equal(b.trades, 1);
  assert.equal(b.wins, 0);
  assert.equal(b.losses, 1);
  assert.equal(b.forcedExits, 1);
  assert.ok(b.totalPnlPct < 0, "gross 0 minus fee must be a loss"); // -0.5
});

test("basisBacktest time-stop force-closes a stuck position", () => {
  const series: PremiumPoint[] = [
    { ts: 1, rClose: 980, perpClose: 1000, premiumPct: -2 },
    { ts: 2, rClose: 980, perpClose: 1000, premiumPct: -2 },
  ];
  const b = basisBacktest(series, 1.0, 0.3, 0.5, 1); // maxHold = 1 bar
  assert.ok(b.forcedExits >= 1);
  assert.equal(b.wins, 0);
});

test("mulberry32 is deterministic for a given seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test("randomBaseline returns reproducible, in-range control numbers", () => {
  const series: PremiumPoint[] = [];
  for (let i = 0; i < 200; i++) series.push({ ts: i, rClose: 100, perpClose: 100, premiumPct: Math.sin(i) * 2 });
  const r1 = randomBaseline(series, 6, 0.3, 0.5, 10, 48, 50, 7);
  const r2 = randomBaseline(series, 6, 0.3, 0.5, 10, 48, 50, 7);
  assert.equal(r1.captureRatePct, r2.captureRatePct, "must be deterministic for a fixed seed");
  assert.equal(r1.basisPnlPct, r2.basisPnlPct);
  assert.ok(r1.captureRatePct >= 0 && r1.captureRatePct <= 100);
  assert.equal(r1.iters, 50);
});

test("convergenceCaptureShuffled produces a poolable base-rate", () => {
  const series: PremiumPoint[] = [];
  for (let i = 0; i < 200; i++) series.push({ ts: i, rClose: 100, perpClose: 100, premiumPct: Math.sin(i) * 2 });
  const sh = convergenceCaptureShuffled(series, 0.5, 6, 20, 123);
  assert.ok(sh.capTotal > 0);
  assert.ok(sh.ratePct >= 0 && sh.ratePct <= 100);
});

test("clairvoyantBound picks the best non-overlapping exit, net of fees", () => {
  // premium -2 then options to close; best is the bar that closes the most gap (to 0).
  const series = [ppt(1, -2), ppt(2, -0.5), ppt(3, -1.5), ppt(4, 0)];
  const cb = clairvoyantBound(series, 1.0, 0.5, 3);
  assert.equal(cb.opportunities, 1);
  assert.ok(Math.abs(cb.maxPnlPct - 1.5) < 1e-9, `max=${cb.maxPnlPct}`); // 2 − 0 − 0.5 fee
});

test("clairvoyantBound takes nothing when no exit beats fees", () => {
  const series = [ppt(1, -2), ppt(2, -2.5), ppt(3, -3)]; // gap only widens
  const cb = clairvoyantBound(series, 1.0, 0.5, 2);
  assert.equal(cb.opportunities, 0);
  assert.equal(cb.maxPnlPct, 0);
});


test("trueGapReversion: a mean-reverting rToken scores positive reversion + correct direction buckets", () => {
  const d = (i: number, close: number): Bar => ({ ts: i * 86_400_000, close });
  const eqBars: Bar[] = [d(0, 100), d(1, 100), d(2, 100), d(3, 100), d(4, 100), d(5, 100)];
  // rToken: cheap at day1 then rises; rich at day3 then falls (reverts to the real anchor).
  const rBars: Bar[] = [d(0, 100), d(1, 98), d(2, 100), d(3, 103), d(4, 100), d(5, 100)];
  const r = trueGapReversion(rBars, eqBars, 1);
  assert.equal(r.n, 2, "two dislocations beyond the 1% stretch");
  assert.ok(r.reversionReturnPct > 0, `reversion should be positive, got ${r.reversionReturnPct}`);
  assert.equal(r.correctiveRatePct, 100);
  assert.ok(r.cheapNextRetPct > 0, "cheap rToken rises next session");
  assert.ok(r.richNextRetPct < 0, "rich rToken falls next session");
});

test("trueGapReversion: look-ahead-safe — anchor is the PRIOR real close, never future", () => {
  // If the rToken sits exactly on each prior real close, there are no dislocations to score.
  const d = (i: number, close: number): Bar => ({ ts: i * 86_400_000, close });
  const eqBars: Bar[] = [d(0, 100), d(1, 101), d(2, 102), d(3, 103)];
  const rBars: Bar[] = [d(0, 100), d(1, 100), d(2, 101), d(3, 102)]; // each r == prior eq → gap ~0
  const r = trueGapReversion(rBars, eqBars, 1);
  assert.equal(r.n, 0);
});

test("gapReversionBuckets slices by gap size (large reverting gaps land in the 2-4% bucket)", () => {
  const d = (i: number, close: number): Bar => ({ ts: i * 86_400_000, close });
  const eqBars: Bar[] = [d(0, 100), d(1, 100), d(2, 100), d(3, 100), d(4, 100)];
  const rBars: Bar[] = [d(0, 100), d(1, 103), d(2, 100), d(3, 103), d(4, 100)]; // ~3% rich → reverts down
  const buckets = gapReversionBuckets(rBars, eqBars);
  const big = buckets.find((b) => b.label === "2-4%")!;
  assert.equal(big.n, 2);
  assert.equal(big.correctiveRatePct, 100);
  assert.ok(big.reversionReturnPct > 0);
  assert.equal(buckets.find((b) => b.label === "0.5-1%")!.n, 0);
});
