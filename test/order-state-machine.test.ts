import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderLifecycle, transition, TERMINAL_STATES } from "../src/execution/order-state-machine";

test("happy path: Initialized -> Submitted -> Accepted -> partial -> Filled", () => {
  const o = new OrderLifecycle(10);
  o.apply({ type: "Submit" });
  assert.equal(o.status, "Submitted");
  o.apply({ type: "Accept" });
  assert.equal(o.status, "Accepted");
  o.apply({ type: "Fill", fillQty: 4 });
  assert.equal(o.status, "PartiallyFilled");
  assert.equal(o.filledQty, 4);
  o.apply({ type: "Fill", fillQty: 6 });
  assert.equal(o.status, "Filled");
  assert.equal(o.isTerminal, true);
});

test("Denied only from Initialized, and requires a typed reason", () => {
  const o = new OrderLifecycle(5);
  assert.throws(() => o.apply({ type: "Deny" }), /requires a typed reason/);
  o.apply({ type: "Deny", reason: "LIQUIDITY_TRAP" });
  assert.equal(o.status, "Denied");
  assert.equal(o.denialReason, "LIQUIDITY_TRAP");
  // cannot Deny after submission (illegal transition)
  const o2 = new OrderLifecycle(5);
  o2.apply({ type: "Submit" });
  assert.throws(() => o2.apply({ type: "Deny", reason: "FEE_EDGE_NOT_MET" }), /illegal transition/);
});

test("venue Rejected only reachable after Submitted", () => {
  const o = new OrderLifecycle(5);
  assert.throws(() => o.apply({ type: "Reject" }), /illegal transition/); // from Initialized
  o.apply({ type: "Submit" });
  o.apply({ type: "Reject" });
  assert.equal(o.status, "Rejected");
});

test("overfill is impossible", () => {
  const o = new OrderLifecycle(10);
  o.apply({ type: "Submit" }).apply({ type: "Accept" }).apply({ type: "Fill", fillQty: 7 });
  assert.throws(() => o.apply({ type: "Fill", fillQty: 5 }), /overfill/);
  assert.equal(o.status, "PartiallyFilled"); // unchanged after the rejected overfill
  assert.equal(o.filledQty, 7);
});

test("Fill requires a positive quantity", () => {
  const o = new OrderLifecycle(10).apply({ type: "Submit" }).apply({ type: "Accept" });
  assert.throws(() => o.apply({ type: "Fill", fillQty: 0 }), /positive fillQty/);
  assert.throws(() => o.apply({ type: "Fill" }), /positive fillQty/);
});

test("terminal states reject any further event", () => {
  const filled = new OrderLifecycle(2).apply({ type: "Submit" }).apply({ type: "Accept" }).apply({ type: "Fill", fillQty: 2 });
  assert.equal(filled.status, "Filled");
  assert.throws(() => filled.apply({ type: "Cancel" }), /terminal/);
  const canceled = new OrderLifecycle(2).apply({ type: "Submit" }).apply({ type: "Accept" }).apply({ type: "Cancel" });
  assert.throws(() => canceled.apply({ type: "Fill", fillQty: 1 }), /terminal/);
});

test("can cancel/expire an open order; cannot fill a canceled order", () => {
  const o = new OrderLifecycle(10).apply({ type: "Submit" }).apply({ type: "Accept" }).apply({ type: "Fill", fillQty: 3 });
  o.apply({ type: "Cancel" });
  assert.equal(o.status, "Canceled");
  assert.equal(o.filledQty, 3); // partial fills are preserved on cancel
});

test("a fill may race a cancel request until cancel acknowledgement", () => {
  const order = new OrderLifecycle(10).apply({ type: "Submit" }).apply({ type: "Accept" });
  order.apply({ type: "CancelRequest" });
  assert.equal(order.status, "CancelPending");
  order.apply({ type: "Fill", fillQty: 3 });
  assert.equal(order.status, "CancelPending");
  assert.equal(order.filledQty, 3);
  order.apply({ type: "CancelAck" });
  assert.equal(order.status, "Canceled");
  assert.equal(order.filledQty, 3);
});

test("a full late fill wins the race against cancel acknowledgement", () => {
  const order = new OrderLifecycle(2).apply({ type: "Submit" }).apply({ type: "Accept" }).apply({ type: "CancelRequest" });
  order.apply({ type: "Fill", fillQty: 2 });
  assert.equal(order.status, "Filled");
  assert.throws(() => order.apply({ type: "CancelAck" }), /terminal/);
});

test("transition() is a pure lookup returning null for illegal moves", () => {
  assert.equal(transition("Initialized", "Submit"), "Submitted");
  assert.equal(transition("Accepted", "Fill"), "PartiallyFilled");
  assert.equal(transition("Initialized", "Fill"), null);
  assert.equal(transition("Filled", "Cancel"), null);
});

test("fromEvents reconstructs identical state (event sourcing)", () => {
  const events = [
    { type: "Submit" as const },
    { type: "Accept" as const },
    { type: "Fill" as const, fillQty: 4 },
    { type: "Fill" as const, fillQty: 6 },
  ];
  const rebuilt = OrderLifecycle.fromEvents(10, events);
  assert.equal(rebuilt.status, "Filled");
  assert.equal(rebuilt.filledQty, 10);
  assert.equal(rebuilt.events.length, 4);
});

test("constructor rejects non-positive quantity", () => {
  assert.throws(() => new OrderLifecycle(0), /quantity must be > 0/);
  assert.throws(() => new OrderLifecycle(-1), /quantity must be > 0/);
});

test("every terminal state has no outgoing transitions", () => {
  for (const s of TERMINAL_STATES) {
    for (const ev of ["Submit", "Deny", "Reject", "Accept", "Fill", "CancelRequest", "CancelAck", "Cancel", "Expire"] as const) {
      assert.equal(transition(s, ev), null, `${s} should have no outgoing ${ev}`);
    }
  }
});
