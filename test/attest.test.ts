import { test } from "node:test";
import assert from "node:assert/strict";
import { attest, verifyAttestation, generateKeypair, canonicalHash } from "../src/ledger/attest";

const records = [
  { cycleId: "A-1", ticker: "NVDA", outcome: "win", gradePnl: 1.2 },
  { cycleId: "B-2", ticker: "TSLA", outcome: "no_trade" },
];

test("attest → verify round-trips true for untampered records", () => {
  const keys = generateKeypair();
  const att = attest(records, keys);
  assert.equal(att.algo, "ed25519");
  assert.equal(att.recordCount, 2);
  assert.equal(verifyAttestation(records, att), true);
});

test("verify fails if any record is tampered", () => {
  const keys = generateKeypair();
  const att = attest(records, keys);
  const tampered = [{ ...records[0], gradePnl: 999 }, records[1]];
  assert.equal(verifyAttestation(tampered, att), false);
});

test("verify fails if the signature is swapped from another key", () => {
  const att = attest(records, generateKeypair());
  const forged = attest(records, generateKeypair());
  // same records + hash, but the signature/publicKey pair is from a different signer when crossed
  const crossed = { ...att, signatureHex: forged.signatureHex };
  assert.equal(verifyAttestation(records, crossed), false);
});

test("canonicalHash is stable and order-sensitive", () => {
  assert.equal(canonicalHash(records), canonicalHash(records));
  assert.notEqual(canonicalHash(records), canonicalHash([records[1], records[0]]));
});


test("ledger JSONL round-trip preserves the signature (the basis of `npm run verify`)", () => {
  const keys = generateKeypair();
  const recs = [
    { cycleId: "A", ts: 1, outcome: "win", nested: { a: 1, b: [2, 3] } },
    { cycleId: "B", ts: 2, outcome: "abstained", counterfactual: { wouldBePnlPct: -0.4, wouldHaveConverged: false, decisionWasRight: true } },
  ];
  const att = attest(recs, keys);
  // simulate save → load: write each record as a JSONL line, then parse each line back
  const jsonl = recs.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const roundTripped = jsonl
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
  assert.equal(verifyAttestation(roundTripped, att), true);
  // tamper: altering any record must flip verification to false
  const mutated = roundTripped.map((r) => ({ ...r }));
  mutated[0] = { ...mutated[0], __tamper: true };
  assert.equal(verifyAttestation(mutated, att), false);
});
