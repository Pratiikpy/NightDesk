import { test } from "node:test";
import assert from "node:assert/strict";
import { alphaConfigToDsl, strategyHash, validateStrategyDsl } from "../src/research/strategy-dsl";
import type { AlphaConfig } from "../src/research/alpha-championship";

const config: AlphaConfig = { id: "test", source: "perp_gap", direction: "fade", entryPct: 0.35, exitPct: 0, takeProfitPct: 2, stopLossPct: 1.25, maxHoldSnapshots: 90, notionalPct: 0.25, maxConcurrent: 2, feePct: 0.1 };

test("AlphaConfig converts to a valid, hard-gated strategy DSL", () => {
  const strategy = alphaConfigToDsl(config);
  assert.deepEqual(validateStrategyDsl(strategy), []);
  assert.equal(strategy.hedge.mode, "informational-perp");
  assert.equal(strategy.risk.hardGatesRequired, true);
});

test("strategy hash is deterministic and sensitive to economic parameters", () => {
  const strategy = alphaConfigToDsl(config);
  assert.equal(strategyHash(strategy), strategyHash(structuredClone(strategy)));
  assert.notEqual(strategyHash(strategy), strategyHash(alphaConfigToDsl({ ...config, entryPct: 0.5 })));
});

test("strategy validation rejects disabled risk and invalid sizing", () => {
  const strategy = alphaConfigToDsl(config);
  const invalid = { ...strategy, sizing: { ...strategy.sizing, notionalPct: 2 }, risk: { certificateRequired: true as const, hardGatesRequired: false as true } };
  assert.ok(validateStrategyDsl(invalid).length >= 2);
});
