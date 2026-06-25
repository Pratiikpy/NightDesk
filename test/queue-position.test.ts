import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAggressorTrade, createQueuePosition } from "../src/execution/queue-position";

test("queue position consumes displayed quantity ahead before filling", () => {
  let position = createQueuePosition("o", "buy", 100, 5, 3);
  let result = applyAggressorTrade(position, { side: "sell", price: 100, qty: 2 });
  assert.equal(result.fillQty, 0);
  assert.equal(result.position.aheadQty, 1);
  position = result.position;
  result = applyAggressorTrade(position, { side: "sell", price: 100, qty: 4 });
  assert.equal(result.fillQty, 3);
  assert.equal(result.position.remainingQty, 2);
});

test("wrong-side or non-marketable trades do not advance queue", () => {
  const position = createQueuePosition("o", "sell", 101, 2, 1);
  assert.equal(applyAggressorTrade(position, { side: "sell", price: 101, qty: 5 }).fillQty, 0);
  assert.equal(applyAggressorTrade(position, { side: "buy", price: 100, qty: 5 }).fillQty, 0);
  assert.deepEqual(position, createQueuePosition("o", "sell", 101, 2, 1));
});

test("queue fills cannot exceed remaining order quantity", () => {
  const position = createQueuePosition("o", "sell", 101, 2, 0);
  const result = applyAggressorTrade(position, { side: "buy", price: 102, qty: 10 });
  assert.equal(result.fillQty, 2);
  assert.equal(result.position.remainingQty, 0);
});
