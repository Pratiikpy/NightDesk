import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mid,
  premiumPct,
  classifyDepeg,
  isTradeable,
  sValueAdjust,
  triangulate,
} from "../src/pegwatch/fairvalue";

test("mid prefers bid/ask midpoint, falls back to last", () => {
  assert.equal(mid({ bid: 100, ask: 102, last: 99 }), 101);
  assert.equal(mid({ bid: null, ask: null, last: 99 }), 99);
  assert.equal(mid({ bid: 0, ask: 0, last: null }), null);
});

test("premiumPct", () => {
  assert.ok(Math.abs(premiumPct(102, 100) - 2) < 1e-9);
  assert.ok(Math.abs(premiumPct(99, 100) - -1) < 1e-9);
});

test("classifyDepeg thresholds (FR-3.3)", () => {
  assert.equal(classifyDepeg(0.3), "NORMAL");
  assert.equal(classifyDepeg(0.5), "STRETCHED");
  assert.equal(classifyDepeg(1.9), "STRETCHED");
  assert.equal(classifyDepeg(2.1), "DISLOCATED");
});

test("isTradeable respects the ~0.32% round-trip fee floor", () => {
  assert.equal(isTradeable(0.2), false);
  assert.equal(isTradeable(0.5), true);
});

test("sValue adjustment prevents a false split/dividend depeg (FR-3.6)", () => {
  // Post 4:1 split, a total-return Ondo token quotes ~4x the per-share underlying; perp ~ underlying.
  const ondoRaw = 400;
  const perp = 100;
  const naive = classifyDepeg(Math.abs(premiumPct(ondoRaw, perp))); // 300% → false DISLOCATED
  assert.equal(naive, "DISLOCATED");
  const adj = sValueAdjust(ondoRaw, 4.0); // → 100
  const corrected = classifyDepeg(Math.abs(premiumPct(adj, perp))); // 0% → NORMAL
  assert.equal(corrected, "NORMAL");
});

test("triangulate flags disagreement and handles missing legs", () => {
  const r = triangulate({ rToken: 103, perp: 100, ondoAdj: 100 }, 1.0);
  assert.equal(r.flagged, true);
  assert.ok(Math.abs((r.rPerpPct ?? 0) - 3) < 1e-9);

  const miss = triangulate({ rToken: null, perp: 100, ondoAdj: 100 }, 1.0);
  assert.equal(miss.rPerpPct, null);
  assert.equal(miss.flagged, false); // ondo↔perp = 0, below threshold
});
