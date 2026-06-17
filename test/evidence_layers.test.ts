import { test } from "node:test";
import assert from "node:assert/strict";
import { runFillRealism } from "../src/research/fill-realism";
import { simulateSession } from "../src/research/session-study";
import { verifyEvidenceArtifacts } from "../src/evidence/verify-artifacts";
import type { Snapshot } from "../src/pegwatch/collect";

test("fill realism report cases all pass", () => {
  const cases = runFillRealism();
  assert.equal(cases.every((c) => c.status === "pass"), true);
});

test("simulateSession handles an empty/no-anchor session safely", () => {
  const row = simulateSession("empty", [] as Snapshot[]);
  assert.equal(row.trades, 0);
  assert.equal(row.blocks, 0);
  assert.equal(row.guarded_pnl, 0);
  assert.match(row.ledger_hash, /^[a-f0-9]{64}$/);
});

test("generated evidence artifacts satisfy schema and consistency checks when present", () => {
  const checks = verifyEvidenceArtifacts();
  assert.deepEqual(checks.filter((c) => !c.ok), []);
});
