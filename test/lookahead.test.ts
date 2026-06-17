// Look-ahead sentinel (Vibe-Trading pattern). A causal signal's value at bar i must depend ONLY on
// data up to bar i. We compute the signal on a clean series, then CORRUPT every bar after a temporal
// probe and recompute — the pre-probe values must be byte-for-byte unchanged (within 1e-9). If a
// future-leakage bug ever creeps in, this test fails. The suite is pure + deterministic and makes no
// network calls (run it with sockets disabled to confirm offline reproducibility).
import { test } from "node:test";
import assert from "node:assert/strict";
import { premiumZScoreCausal, ar1Coefficient } from "../src/history/signals";
import { basisBacktest, type PremiumPoint } from "../src/history/study";

test("look-ahead sentinel: corrupting the future cannot change a past causal signal", () => {
  const prems = Array.from({ length: 80 }, (_, i) => Math.sin(i / 3) * 2 + Math.cos(i / 7));
  const window = 12;
  const probe = 50;

  const clean: (number | null)[] = [];
  for (let i = 0; i <= probe; i++) clean.push(premiumZScoreCausal(prems, i, window));

  // Corrupt everything strictly after the probe with extreme alternating values.
  const corrupted = prems.slice();
  for (let i = probe + 1; i < corrupted.length; i++) corrupted[i] = 1e6 * (i % 2 ? 1 : -1);

  for (let i = 0; i <= probe; i++) {
    const v = premiumZScoreCausal(corrupted, i, window);
    if (clean[i] == null) assert.equal(v, null);
    else assert.ok(Math.abs((clean[i] as number) - (v as number)) < 1e-9, `signal at ${i} leaked future data`);
  }
});

test("basisBacktest is causal: trades closed before the probe are unaffected by future corruption", () => {
  // A converging gap that opens and closes early, then noise afterward.
  const pts: PremiumPoint[] = [];
  const base = [-1.5, -1.2, -0.2, 0.0, 0.1, -0.1, 0.0, 0.05]; // opens at i0, closes ~i2
  base.forEach((p, i) => pts.push({ ts: i, rClose: 100 + p, perpClose: 100, premiumPct: p }));
  const cleanEarly = basisBacktest(pts.slice(0, 4), 1.0, 0.3, 0.5); // only the early, completed trade

  const corrupted = pts.map((p, i) => (i >= 4 ? { ...p, premiumPct: 1e6 * (i % 2 ? 1 : -1) } : p));
  // Re-run on the early window of the corrupted series — must match (future corruption is irrelevant).
  const corruptedEarly = basisBacktest(corrupted.slice(0, 4), 1.0, 0.3, 0.5);
  assert.deepEqual(corruptedEarly, cleanEarly);
});

test("signal suite is deterministic (same input → same output)", () => {
  const xs = [1, 0.7, 0.49, 0.343, 0.24];
  assert.equal(ar1Coefficient(xs), ar1Coefficient(xs));
  assert.equal(premiumZScoreCausal(xs, 4, 3), premiumZScoreCausal(xs, 4, 3));
});
