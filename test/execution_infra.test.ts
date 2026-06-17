import { test } from "node:test";
import assert from "node:assert/strict";
import { RunBus, ComponentLifecycle } from "../src/execution/bus";
import { deterministicOrderId, DuplicateOrderGuard, validateCertifiedOrder } from "../src/execution/risk";
import { Account } from "../src/bitsim/account";
import type { CertifiedOrder } from "../src/execution/risk";
import type { MarketQuote } from "../src/bitsim/types";

const quote: MarketQuote = { symbol: "rNVDUSDT", bid: 100, ask: 101, last: 100.5 };

function order(overrides: Partial<CertifiedOrder> = {}): CertifiedOrder {
  return {
    id: "o1",
    accountId: "a1",
    symbol: "rNVDUSDT",
    kind: "spot",
    side: "buy",
    type: "market",
    qty: 0.1,
    ts: 1,
    certificateId: "cert",
    maxNotionalUsd: 20,
    ...overrides,
  };
}

test("RunBus publishes immutable topic messages and caches latest", () => {
  const bus = new RunBus();
  let seen = 0;
  bus.subscribe("data.snapshot", (msg) => {
    seen++;
    assert.equal(msg.topic, "data.snapshot");
    assert.equal(msg.event.type, "MARKET_SNAPSHOT");
    assert.throws(() => ((msg.event as { tokens: number }).tokens = 99));
  });
  const msg = bus.publish("data.snapshot", { type: "MARKET_SNAPSHOT", timestamp: "t", runId: "r", tokens: 1, source: "fixture" });
  assert.equal(seen, 1);
  assert.equal(bus.latest("data.snapshot"), msg);
});

test("ComponentLifecycle rejects impossible transitions", () => {
  const lifecycle = new ComponentLifecycle("risk-engine");
  assert.deepEqual(lifecycle.transition("READY"), { from: "PRE_INITIALIZED", to: "READY" });
  assert.deepEqual(lifecycle.transition("STARTING"), { from: "READY", to: "STARTING" });
  assert.deepEqual(lifecycle.transition("RUNNING"), { from: "STARTING", to: "RUNNING" });
  assert.throws(() => lifecycle.transition("DISPOSED"), /invalid/);
});

test("deterministicOrderId is stable and duplicate guard rejects repeats", () => {
  const id = deterministicOrderId(["run", "NVDA", 1]);
  assert.equal(id, deterministicOrderId(["run", "NVDA", 1]));
  assert.notEqual(id, deterministicOrderId(["run", "NVDA", 2]));
  const guard = new DuplicateOrderGuard();
  assert.equal(guard.check(id).ok, true);
  const dup = guard.check(id);
  assert.equal(dup.ok, false);
  assert.equal(dup.reasonCode, "DUPLICATE_ORDER");
});

test("validateCertifiedOrder denies free-balance excess, halted trading, and naked spot sells", () => {
  const account = new Account("a1", 5);
  assert.equal(validateCertifiedOrder({ order: order(), account, quote, tradingState: "ACTIVE" }).reasonCode, "NOTIONAL_EXCEEDS_FREE_BALANCE");
  const funded = new Account("a1", 100);
  assert.equal(validateCertifiedOrder({ order: order(), account: funded, quote, tradingState: "HALTED" }).reasonCode, "TRADING_HALTED");
  assert.equal(validateCertifiedOrder({ order: order({ side: "sell" }), account: funded, quote, tradingState: "ACTIVE" }).reasonCode, "NAKED_SPOT_SELL");
  assert.equal(validateCertifiedOrder({ order: order(), account: funded, quote, tradingState: "ACTIVE" }).ok, true);
});
