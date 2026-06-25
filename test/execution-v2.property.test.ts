import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { depthFill } from "../src/bitsim/fills";
import { applyAggressorTrade, createQueuePosition } from "../src/execution/queue-position";

test("property: depth fills never exceed quantity or violate a buy limit", () => {
  fc.assert(fc.property(
    fc.double({ min: 1, max: 1_000, noNaN: true }),
    fc.double({ min: 0.001, max: 100, noNaN: true }),
    fc.double({ min: 0.001, max: 100, noNaN: true }),
    (price, firstSize, quantity) => {
      const result = depthFill("buy", quantity, { bids: [], asks: [[price, firstSize], [price * 1.01, quantity]] }, price);
      assert.ok(result.fillQty >= 0 && result.fillQty <= quantity + 1e-9);
      if (result.avgPrice != null) assert.ok(result.avgPrice <= price + 1e-9);
    }
  ), { numRuns: 1_000 });
});

test("property: queue accounting conserves original order quantity", () => {
  fc.assert(fc.property(
    fc.double({ min: 0.001, max: 1_000, noNaN: true }),
    fc.double({ min: 0, max: 1_000, noNaN: true }),
    fc.array(fc.double({ min: 0.001, max: 1_000, noNaN: true }), { minLength: 1, maxLength: 20 }),
    (quantity, ahead, trades) => {
      let position = createQueuePosition("o", "buy", 100, quantity, ahead);
      for (const qty of trades) position = applyAggressorTrade(position, { side: "sell", price: 100, qty }).position;
      assert.ok(position.aheadQty >= -1e-9);
      assert.ok(position.remainingQty >= -1e-9);
      assert.ok(Math.abs(position.filledQty + position.remainingQty - quantity) < 1e-7);
    }
  ), { numRuns: 1_000 });
});
