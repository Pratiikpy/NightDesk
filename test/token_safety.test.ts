// Token Safety Standard — golden-grade tests. Synthetic tokens with known tracking error / stability
// / liquidity must map to the exact A/B/C/D bands the standard defines (TOKEN_SAFETY_STANDARD.md),
// and the grade must never improve when the inputs get worse (monotonicity). This backs the
// "rating agency" claim with deterministic tests, not prose.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { buildRightsFlags, tokenQuality, type TrackingError, type RightsFlags } from "../src/history/tracking";

const flags = (meanAbs: number, stdev: number, liq: RightsFlags["liquidity"], nDays = 30): RightsFlags => {
  const t: TrackingError = { nDays, meanAbsPremiumPct: meanAbs, stdevPremiumPct: stdev, maxAbsPremiumPct: meanAbs * 2, returnCorrelation: 0.5 };
  return buildRightsFlags("X", t, liq);
};

test("golden grades: tight/steady/liquid → A, …, poor/volatile/thin → D", () => {
  assert.equal(tokenQuality(flags(0.3, 0.3, "L2-book")).grade, "A"); // ≈94
  assert.equal(tokenQuality(flags(1.0, 1.0, "L2-book")).grade, "B"); // ≈80
  assert.equal(tokenQuality(flags(1.6, 2.0, "quote-only")).grade, "C"); // ≈57
  assert.equal(tokenQuality(flags(2.5, 3.0, "quote-only")).grade, "D"); // ≈38
});

test("insufficient data → n/a (never a tradeable grade)", () => {
  const q = tokenQuality(flags(0.3, 0.3, "L2-book", 3)); // < 5 aligned days
  assert.equal(q.grade, "n/a");
});

test("rights are never fabricated", () => {
  const f = flags(0.3, 0.3, "L2-book");
  assert.match(f.dividends, /not verified/);
  assert.match(f.votingRights, /not verified/);
  assert.equal(tokenQuality(f).rightsClarity, "not verified");
});

test("score is bounded 0–100 and monotone: worse inputs never raise the grade score", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 5, noNaN: true }),
      fc.double({ min: 0, max: 5, noNaN: true }),
      fc.double({ min: 0, max: 2, noNaN: true }),
      (meanAbs, stdev, bump) => {
        const better = tokenQuality(flags(meanAbs, stdev, "L2-book"));
        const worse = tokenQuality(flags(meanAbs + bump, stdev + bump, "L2-book")); // strictly worse tracking
        const inRange = better.qualityScore >= 0 && better.qualityScore <= 100 && worse.qualityScore >= 0 && worse.qualityScore <= 100;
        return inRange && worse.qualityScore <= better.qualityScore + 1e-9;
      }
    )
  );
});
