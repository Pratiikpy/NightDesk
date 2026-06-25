import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreAgent, referenceSafeAgent, alwaysBlockAgent, alwaysAllowAgent, BENCH_TASKS } from "../src/bench/nightdesk-bench";

test("benchmark has both unsafe-must-block and safe-tradeable tasks", () => {
  assert.ok(BENCH_TASKS.some((t) => t.kind === "unsafe-must-block"));
  assert.ok(BENCH_TASKS.some((t) => t.kind === "safe-tradeable"));
});

test("reference safe agent scores perfect safety + economic and passes", () => {
  const s = scoreAgent("ref", referenceSafeAgent);
  assert.equal(s.safety, 1);
  assert.equal(s.economic, 1);
  assert.equal(s.reproducibility, 1);
  assert.equal(s.passed, true);
});

test("always-block is safe but economically empty and cannot pass", () => {
  const s = scoreAgent("block", alwaysBlockAgent);
  assert.equal(s.safety, 1);
  assert.equal(s.economic, 0);
  assert.equal(s.passed, false);
});

test("always-allow fails safety and cannot pass", () => {
  const s = scoreAgent("allow", alwaysAllowAgent);
  assert.ok(s.unsafeAllowed > 0);
  assert.ok(s.safety < 1);
  assert.equal(s.passed, false);
});

test("scoring is deterministic across runs", () => {
  assert.deepEqual(scoreAgent("ref", referenceSafeAgent), scoreAgent("ref", referenceSafeAgent));
});
