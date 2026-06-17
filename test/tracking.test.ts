import { test } from "node:test";
import assert from "node:assert/strict";
import { trackingError, trackingGrade, buildRightsFlags, tokenQuality, type Bar } from "../src/history/tracking";

const day = (i: number, close: number): Bar => ({ ts: i * 86_400_000, close });

test("trackingError: a constant 1% premium that moves with the stock is tight, corr ~1", () => {
  const eq = [100, 102, 101, 103, 105, 106].map((c, i) => day(i, c));
  const r = eq.map((b, i) => day(i, b.close * 1.01)); // rToken always 1% above, same daily moves
  const t = trackingError(r, eq);
  assert.equal(t.nDays, 6);
  assert.ok(Math.abs(t.meanAbsPremiumPct - 1.0) < 1e-6, `meanAbs=${t.meanAbsPremiumPct}`);
  assert.ok(t.returnCorrelation! > 0.999);
  assert.equal(trackingGrade(t), "tight");
});

test("trackingError aligns only on shared dates", () => {
  const eq = [day(0, 100), day(1, 100), day(2, 100)];
  const r = [day(1, 102), day(2, 103), day(3, 999)]; // day 3 has no equity → excluded
  const t = trackingError(r, eq);
  assert.equal(t.nDays, 2);
});

test("trackingGrade is n/a with too few aligned days", () => {
  const eq = [day(0, 100), day(1, 101)];
  const r = [day(0, 101), day(1, 102)];
  assert.equal(trackingGrade(trackingError(r, eq)), "n/a");
});

test("buildRightsFlags NEVER asserts legal rights", () => {
  const f = buildRightsFlags("NVDA", trackingError([], []), "quote-only");
  assert.match(f.dividends, /not verified/);
  assert.match(f.votingRights, /not verified/);
  assert.match(f.corporateActions, /not verified/);
  assert.match(f.structure, /rToken/);
  assert.equal(f.liquidity, "quote-only");
  assert.equal(f.tracking.nDays, 0);
});


test("tokenQuality: a tight, steady, L2-book token grades high; rights excluded", () => {
  const eq = [100, 101, 100, 102, 101, 103].map((c, i) => day(i, c));
  const r = eq.map((b, i) => day(i, b.close * 1.003)); // ~0.3% level gap, very steady
  const q = tokenQuality(buildRightsFlags("SPY", trackingError(r, eq), "L2-book"));
  assert.ok(["A", "B"].includes(q.grade), `grade=${q.grade} score=${q.qualityScore}`);
  assert.equal(q.components.liquidity, 100);
  assert.equal(q.rightsClarity, "not verified"); // never folded into the score
});

test("tokenQuality: a loose, volatile, illiquid token grades low", () => {
  const eq = [100, 100, 100, 100, 100, 100].map((c, i) => day(i, c));
  const r = [104, 97, 105, 96, 103, 98].map((c, i) => day(i, c)); // big, swinging premium
  const q = tokenQuality(buildRightsFlags("CRCL", trackingError(r, eq), "unknown"));
  assert.equal(q.grade, "D", `score=${q.qualityScore}`);
});

test("tokenQuality is n/a with too few aligned days", () => {
  const q = tokenQuality(buildRightsFlags("X", trackingError([day(0, 100)], [day(0, 100)]), "quote-only"));
  assert.equal(q.grade, "n/a");
});
