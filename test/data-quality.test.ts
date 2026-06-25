import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProvenanceEvent } from "../src/data/provenance";
import { DataQualityEngine, resolveNumericConsensus } from "../src/data/quality";

const policy = [{ source: "feed", reliability: 0.95, maxEffectiveAgeMs: 100 }];

function event(sequence: number, payload: Record<string, unknown> = { bid: 99, ask: 101, last: 100 }) {
  return normalizeProvenanceEvent({
    eventId: `event-${sequence}`,
    kind: "market.quote",
    source: "feed",
    instrument: "NVDA",
    effectiveAt: 100,
    observedAt: 110,
    receivedAt: 120,
    sequence,
    payload,
  });
}

test("data quality detects sequence gaps and quarantines regressions", () => {
  const engine = new DataQualityEngine(policy);
  assert.equal(engine.assess(event(1)).quality.status, "valid");
  const gap = engine.assess(event(3));
  assert.equal(gap.quality.status, "degraded");
  assert.ok(gap.quality.reasons.includes("sequence_gap"));
  assert.deepEqual(engine.gaps().map((row) => [row.expected, row.actual]), [[2, 3]]);
  const regression = engine.assess(event(2));
  assert.equal(regression.quality.status, "quarantined");
  assert.ok(regression.quality.reasons.includes("sequence_regression"));
});

test("data quality quarantines crossed quotes and degrades stale data", () => {
  const engine = new DataQualityEngine(policy);
  const crossed = engine.assess(event(1, { bid: 102, ask: 101, last: 101.5 }));
  assert.equal(crossed.quality.status, "quarantined");
  const stale = engine.assess(normalizeProvenanceEvent({
    eventId: "stale",
    kind: "market.quote",
    source: "feed",
    instrument: "NVDA",
    effectiveAt: 1,
    observedAt: 2,
    receivedAt: 1000,
    sequence: 2,
    payload: { bid: 99, ask: 101, last: 100 },
  }));
  assert.equal(stale.quality.status, "degraded");
  assert.ok(stale.quality.reasons.includes("effective_data_stale"));
});

test("numeric consensus fails closed on contradictory anchors", () => {
  const good = resolveNumericConsensus([
    { source: "a", value: 100, qualityScore: 1 },
    { source: "b", value: 100.1, qualityScore: 0.9 },
  ], 0.25);
  assert.equal(good.status, "consensus");
  assert.ok(good.value != null);

  const conflict = resolveNumericConsensus([
    { source: "a", value: 100, qualityScore: 1 },
    { source: "b", value: 110, qualityScore: 1 },
  ], 1);
  assert.equal(conflict.status, "contradiction");
  assert.equal(conflict.value, null);
});

test("equity last-sale observations do not require exchange bid/ask fields", () => {
  const engine = new DataQualityEngine([{ source: "equity", reliability: 0.9, maxEffectiveAgeMs: 1_000 }]);
  const assessed = engine.assess(normalizeProvenanceEvent({
    eventId: "equity",
    kind: "equity.quote",
    source: "equity",
    instrument: "NVDA",
    effectiveAt: 100,
    observedAt: 110,
    receivedAt: 120,
    payload: { price: 100, bid: null, ask: null },
  }));
  assert.equal(assessed.quality.status, "valid");
  assert.equal(assessed.quality.ruleVersion, "nightdesk.quality.v1");
});
