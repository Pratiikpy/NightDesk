import test from "node:test";
import assert from "node:assert/strict";
import { calculateCoverage } from "../src/data/coverage";
import { normalizeProvenanceEvent } from "../src/data/provenance";

test("coverage quantifies cadence gaps, latency, and quality by stream", () => {
  const times = [100, 200, 1_000];
  const events = times.map((receivedAt, index) => normalizeProvenanceEvent({
    eventId: `q-${index}`,
    kind: "market.quote",
    source: "feed",
    instrument: "NVDA",
    effectiveAt: receivedAt - 10,
    observedAt: receivedAt,
    receivedAt,
    quality: index === 1 ? { status: "degraded", score: 0.5, reasons: ["fixture"] } : undefined,
    payload: { price: 100 + index },
  }));
  const [coverage] = calculateCoverage(events, 100);
  assert.equal(coverage?.events, 3);
  assert.equal(coverage?.valid, 2);
  assert.equal(coverage?.degraded, 1);
  assert.equal(coverage?.cadenceGaps, 1);
  assert.equal(coverage?.estimatedMissingIntervals, 7);
  assert.equal(coverage?.p95LatencyMs, 10);
});
