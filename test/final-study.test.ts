import { test } from "node:test";
import assert from "node:assert/strict";
import { comparativeStudy, freezeManifest, CLAIM_LEDGER, CLAIM_BOUNDARIES } from "../src/research/final-study";

test("comparative study is deterministic (locked hash)", () => {
  assert.equal(comparativeStudy().hash, comparativeStudy().hash);
  assert.equal(comparativeStudy().agents.length, 3);
});

test("freeze manifest is stable and carries the claim boundaries", () => {
  assert.equal(freezeManifest().hash, freezeManifest().hash);
  assert.ok(freezeManifest().claimBoundaries >= 5);
  assert.ok(CLAIM_BOUNDARIES.length >= 5);
});

test("claim ledger entries each have evidence + reproduce fields", () => {
  assert.ok(CLAIM_LEDGER.length >= 5);
  for (const c of CLAIM_LEDGER) {
    assert.ok(c.claim && c.evidence && c.reproduce);
  }
});
