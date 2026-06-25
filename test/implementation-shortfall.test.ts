import { test } from "node:test";
import assert from "node:assert/strict";
import { implementationShortfall } from "../src/execution/implementation-shortfall";

test("implementation shortfall attributes delay, execution, and fees for a buy", () => {
  const result = implementationShortfall({ side: "buy", quantity: 10, decisionPrice: 100, arrivalPrice: 100.2, fillPrice: 100.3, fees: 1 });
  assert.ok(Math.abs(result.delayCost - 2) < 1e-9);
  assert.ok(Math.abs(result.executionCost - 1) < 1e-9);
  assert.ok(Math.abs(result.totalCost - 4) < 1e-9);
  assert.ok(Math.abs(result.totalBps - 40) < 1e-9);
});

test("adverse movement for a sell is measured with the correct sign", () => {
  const result = implementationShortfall({ side: "sell", quantity: 5, decisionPrice: 100, arrivalPrice: 99.8, fillPrice: 99.5 });
  assert.ok(result.delayCost > 0);
  assert.ok(result.executionCost > 0);
});
