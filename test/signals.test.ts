import { test } from "node:test";
import assert from "node:assert/strict";
import { ar1Coefficient, halfLifeBars, median, alignCrossSection, crossSectionalStress } from "../src/history/signals";
import type { PremiumPoint } from "../src/history/study";

const pp = (ts: number, premiumPct: number): PremiumPoint => ({ ts, rClose: 100 + premiumPct, perpClose: 100, premiumPct });

test("ar1Coefficient recovers a known persistence (0.5)", () => {
  const xs = [1, 0.5, 0.25, 0.125, 0.0625, 0.03125];
  const b = ar1Coefficient(xs)!;
  assert.ok(Math.abs(b - 0.5) < 1e-6, `b=${b}`);
});

test("halfLifeBars is finite for a mean-reverting series, Infinity for a trend", () => {
  const reverting = [1, 0.5, 0.25, 0.125, 0.0625].map((v, i) => pp(i, v));
  assert.ok(Math.abs(halfLifeBars(reverting) - 1) < 1e-6); // b=0.5 → half-life 1 bar
  const trending = [1, 2, 3, 4, 5].map((v, i) => pp(i, v));
  assert.equal(halfLifeBars(trending), Infinity); // b=1 → not reverting
});

test("median ignores non-finite and handles even/odd", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([Infinity, 1, 3]), 2);
  assert.equal(median([]), 0);
});

test("crossSectionalStress = mean absolute premium across tickers", () => {
  const row = new Map([["A", 1], ["B", -3]]);
  assert.equal(crossSectionalStress(row), 2);
  assert.equal(crossSectionalStress(new Map()), 0);
});

test("alignCrossSection groups premiums by timestamp", () => {
  const byTicker = new Map<string, PremiumPoint[]>([
    ["A", [pp(1, 0.5), pp(2, 1.0)]],
    ["B", [pp(1, -0.2), pp(2, 0.3)]],
  ]);
  const xs = alignCrossSection(byTicker);
  assert.equal(xs.get(1)!.get("A"), 0.5);
  assert.equal(xs.get(1)!.get("B"), -0.2);
  assert.equal(xs.get(2)!.size, 2);
});
