import { test } from "node:test";
import assert from "node:assert/strict";
import { generateHypotheses } from "../src/research/hypothesis-agent";
import { validateStrategyDsl } from "../src/research/strategy-dsl";
import type { CouncilEvidenceFact } from "../src/council/grounding";

const ASOF = Date.parse("2026-06-14T14:00:00.000Z");
const f = (id: string, kind: CouncilEvidenceFact["kind"], value: string | number, observedAt = ASOF, ttl = 300_000): CouncilEvidenceFact =>
  ({ id, kind, value, source: "test", observedAt, expiresAt: observedAt + ttl, hash: "t" });

test("generates valid, grounded DSL experiments from market + event evidence", () => {
  const ev = [f("event:magnitude_pct", "event", 1.0), f("market:premium_pct", "market", -0.97), f("market:fair_value", "market", 207)];
  const hyps = generateHypotheses({ evidence: ev, asOf: ASOF });
  assert.ok(hyps.length >= 1, "at least one experiment");
  for (const h of hyps) {
    assert.equal(validateStrategyDsl(h.strategy).length, 0, "every experiment is DSL-safe");
    assert.ok(h.citations.includes("event:magnitude_pct") && h.citations.includes("market:premium_pct"), "grounded in cited facts");
    assert.equal(h.strategy.signal.source, "equity_gap");
    assert.equal(h.strategy.signal.direction, "fade");
    assert.equal(h.strategy.risk.certificateRequired, true);
  }
});

test("is deterministic — same inputs produce the same experiments", () => {
  const ev = [f("event:magnitude_pct", "event", 1.0), f("market:premium_pct", "market", -0.97)];
  const a = generateHypotheses({ evidence: ev, asOf: ASOF });
  const b = generateHypotheses({ evidence: ev, asOf: ASOF });
  assert.deepEqual(a.map((h) => h.strategyHash), b.map((h) => h.strategyHash));
});

test("point-in-time isolation — a future fact does not change the experiments (no leakage)", () => {
  const present = [f("event:magnitude_pct", "event", 1.0), f("market:premium_pct", "market", -0.97)];
  const withFuture = [...present, f("market:premium_pct", "market", 9.9, ASOF + 60_000)]; // observed AFTER asOf
  assert.deepEqual(
    generateHypotheses({ evidence: present, asOf: ASOF }).map((h) => h.strategyHash),
    generateHypotheses({ evidence: withFuture, asOf: ASOF }).map((h) => h.strategyHash),
    "the future fact is ignored — the agent cannot see past its as-of cutoff",
  );
});

test("ungrounded request yields no experiment (no market or no event fact)", () => {
  assert.equal(generateHypotheses({ evidence: [], asOf: ASOF }).length, 0);
  assert.equal(generateHypotheses({ evidence: [f("event:magnitude_pct", "event", 1.0)], asOf: ASOF }).length, 0);
  assert.equal(generateHypotheses({ evidence: [f("market:premium_pct", "market", -0.97)], asOf: ASOF }).length, 0);
});

test("perp_gap source and informational hedge when no equity fair value is present", () => {
  const ev = [f("event:magnitude_pct", "event", 0.8), f("market:premium_pct", "market", 0.7)];
  const hyps = generateHypotheses({ evidence: ev, asOf: ASOF });
  assert.ok(hyps.length >= 1);
  assert.ok(hyps.every((h) => h.strategy.signal.source === "perp_gap"));
  assert.ok(hyps.every((h) => h.strategy.hedge.mode === "informational-perp"));
});
