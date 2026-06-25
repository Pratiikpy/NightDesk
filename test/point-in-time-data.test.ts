import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeProvenanceEvent, provenanceHash } from "../src/data/provenance";
import { PointInTimeStore } from "../src/data/point-in-time-store";

function quote(eventId: string, receivedAt: number, price: number, status: "valid" | "quarantined" = "valid") {
  return normalizeProvenanceEvent({
    eventId,
    kind: "equity.quote",
    source: "equity-primary",
    instrument: "nvda",
    effectiveAt: 100,
    observedAt: 110,
    receivedAt,
    quality: { status },
    payload: { price, currency: "USD" },
  });
}

test("provenance hashes are stable across object key order", () => {
  assert.equal(provenanceHash({ a: 1, b: 2 }), provenanceHash({ b: 2, a: 1 }));
});

test("provenance rejects impossible timestamps and invalid quality", () => {
  assert.throws(() => normalizeProvenanceEvent({ eventId: "x", kind: "market.quote", source: "s", effectiveAt: 1, observedAt: 3, receivedAt: 2, payload: {} }), /receivedAt/);
  assert.throws(() => normalizeProvenanceEvent({ eventId: "x", kind: "market.quote", source: "s", effectiveAt: 1, observedAt: 2, receivedAt: 3, quality: { score: 2 }, payload: {} }), /quality.score/);
});

test("provenance permits scheduled events known before their effective date", () => {
  const event = normalizeProvenanceEvent({ eventId: "future-action", kind: "corporate.action", source: "issuer", effectiveAt: 500, observedAt: 100, receivedAt: 110, payload: { action: "split" } });
  assert.equal(event.effectiveAt, 500);
  assert.equal(event.receivedAt, 110);
});

test("point-in-time replay excludes future-arriving revisions and quarantined data", () => {
  const root = mkdtempSync(join(tmpdir(), "nightdesk-pit-"));
  try {
    const store = new PointInTimeStore(root);
    store.append(quote("original", 120, 100));
    store.append(quote("future-revision", 220, 105));
    store.append(quote("bad-tick", 115, 999, "quarantined"));

    assert.deepEqual(store.replay({ asOfReceivedAt: 150, instrument: "NVDA" }).map((e) => e.eventId), ["original"]);
    assert.deepEqual(store.replay({ asOfReceivedAt: 250, instrument: "NVDA" }).map((e) => e.eventId), ["original", "future-revision"]);
    assert.deepEqual(store.replay({ asOfReceivedAt: 150, instrument: "NVDA", includeQuarantined: true }).map((e) => e.eventId), ["bad-tick", "original"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("point-in-time store is idempotent and rejects conflicting event reuse after restart", () => {
  const root = mkdtempSync(join(tmpdir(), "nightdesk-pit-"));
  try {
    const first = new PointInTimeStore(root);
    const event = quote("same", 120, 100);
    assert.equal(first.append(event).status, "appended");
    assert.equal(first.append(event).status, "duplicate");

    const restarted = new PointInTimeStore(root);
    assert.equal(restarted.append(event).status, "duplicate");
    assert.throws(() => restarted.append(quote("same", 120, 101)), /eventId conflict/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
