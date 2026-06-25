import { test } from "node:test";
import assert from "node:assert/strict";
import { redactBundle, bundleContains, replayState, stateHash, migrateV1toV2, generateSbom, type ReplayEvent } from "../src/ops/reliability";

test("event replay reconstructs the same state regardless of arrival order; a dropped event differs", () => {
  const events: ReplayEvent[] = [
    { seq: 1, type: "fill", amount: 1.2, orderId: "o1" },
    { seq: 2, type: "fill", amount: -0.5, orderId: "o2" },
    { seq: 3, type: "grade", amount: 0.8 },
  ];
  assert.equal(stateHash(replayState(events)), stateHash(replayState([...events].reverse())));
  assert.notEqual(stateHash(replayState(events)), stateHash(replayState(events.slice(0, 2))));
});

test("v1 -> v2 migration preserves every field", () => {
  const m = migrateV1toV2({ schema: "v1", id: "r1", pnl: 2.5 });
  assert.equal(m.id, "r1");
  assert.equal(m.pnl, 2.5);
  assert.equal(m.schema, "v2");
  assert.ok(m.certificateId);
});

test("redaction removes secrets at any depth but keeps non-secret fields", () => {
  const planted = "redaction-probe-DEADBEEF"; // synthetic, not a real credential
  const redacted = redactBundle({ apiKey: planted, nested: { passphrase: planted, note: "keep" }, arr: [{ token: planted }] });
  assert.equal(bundleContains(redacted, planted), false);
  assert.equal(bundleContains(redacted, "keep"), true);
  assert.equal(bundleContains(redacted, "[REDACTED]"), true);
});

test("SBOM inventories pinned dependencies", () => {
  const sbom = generateSbom({ name: "x", version: "1.0.0", dependencies: { "p-limit": "^5.0.0" }, devDependencies: { tsx: "^4.0.0" } });
  assert.equal(sbom.componentCount, 2);
  assert.ok(sbom.components.every((c) => c.name && c.version));
});
