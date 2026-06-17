import { test } from "node:test";
import assert from "node:assert/strict";
import { ConvergenceMemory, premiumBucket, recencyWeight } from "../src/memory/convergence";

test("premiumBucket encodes direction + magnitude band", () => {
  assert.equal(premiumBucket(-0.3), "long/0-0.5");
  assert.equal(premiumBucket(-0.9), "long/0.5-1");
  assert.equal(premiumBucket(1.5), "short/1-2");
  assert.equal(premiumBucket(2.5), "short/2+");
});

test("recencyWeight halves every half-life", () => {
  const hl = 30;
  assert.ok(Math.abs(recencyWeight(0, hl) - 1) < 1e-9);
  assert.ok(Math.abs(recencyWeight(30 * 86_400_000, hl) - 0.5) < 1e-9);
  assert.ok(Math.abs(recencyWeight(60 * 86_400_000, hl) - 0.25) < 1e-9);
});

test("recall on an unseen key returns an empty prior", () => {
  const m = new ConvergenceMemory();
  const p = m.recall("NVDA", "short/1-2");
  assert.equal(p.n, 0);
  assert.equal(p.confidence, 0);
  assert.match(p.summary, /no prior/);
});

test("recall is recency+importance weighted (recent converged dominates an old miss)", () => {
  const now = Date.UTC(2026, 5, 15);
  const m = new ConvergenceMemory();
  // old, far in the past, did NOT converge
  m.add({ ticker: "NVDA", ts: now - 200 * 86_400_000, bucket: "short/2+", premiumPct: 2.5, converged: false, narrowingPp: -0.1, pnlPct: -0.1, holdBars: 0 });
  // recent, converged
  m.add({ ticker: "NVDA", ts: now - 1 * 86_400_000, bucket: "short/2+", premiumPct: 2.5, converged: true, narrowingPp: 1.2, pnlPct: 1.2, holdBars: 4 });
  const p = m.recall("NVDA", "short/2+", now);
  assert.equal(p.n, 2);
  assert.ok(p.convergedRatePct > 80, `recent converged should dominate, got ${p.convergedRatePct}`);
  assert.ok(p.avgNarrowingPp > 0);
});
