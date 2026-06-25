import test from "node:test";
import assert from "node:assert/strict";
import { adjustHistoricalPriceForSplits, knownCorporateActions, splitAdjustmentFactor, type CorporateActionPayload } from "../src/data/corporate-actions";
import { normalizeProvenanceEvent, type ProvenanceEvent } from "../src/data/provenance";

function split(id: string, effectiveAt: number, receivedAt: number, from: number, to: number): ProvenanceEvent<CorporateActionPayload> {
  return normalizeProvenanceEvent({
    eventId: id,
    kind: "corporate.action",
    source: "actions-primary",
    instrument: "NVDA",
    effectiveAt,
    observedAt: receivedAt,
    receivedAt,
    payload: { actionType: "split", ticker: "NVDA", announcedAt: receivedAt, exDate: "2027-01-15", ratioFrom: from, ratioTo: to },
  });
}

test("corporate action lookup is point-in-time safe", () => {
  const known = split("known", 200, 150, 1, 2);
  const futureKnowledge = split("future", 250, 300, 1, 4);
  assert.deepEqual(knownCorporateActions([known, futureKnowledge], 200, "NVDA").map((row) => row.eventId), ["known"]);
});

test("split adjustment applies only actions effective between price and target", () => {
  const action = split("two-for-one", 200, 150, 1, 2);
  assert.equal(splitAdjustmentFactor([action], 100, 300), 0.5);
  assert.equal(adjustHistoricalPriceForSplits(100, [action], 100, 300), 50);
  assert.equal(adjustHistoricalPriceForSplits(100, [action], 250, 300), 100);
});

test("invalid split ratios fail instead of silently corrupting history", () => {
  const bad = split("bad", 200, 150, 0, 2);
  assert.throws(() => splitAdjustmentFactor([bad], 100, 300), /invalid split ratio/);
});
