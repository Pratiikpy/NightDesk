import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteFill, depthFill, DEFAULT_FILL } from "../src/bitsim/fills";
import { Account } from "../src/bitsim/account";
import { BitSim } from "../src/bitsim/engine";
import type { MarketQuote, Order } from "../src/bitsim/types";

test("quoteFill buys at ask, sells at bid, with size-aware slippage", () => {
  const q: MarketQuote = { symbol: "RAAPLUSDT", bid: 100, ask: 100.2, last: 100.1 };
  const small = quoteFill("buy", 1, q, DEFAULT_FILL); // tiny notional → ~no impact
  assert.ok(small.avgPrice! >= 100.2 && small.avgPrice! < 100.25);
  const sell = quoteFill("sell", 1, q, DEFAULT_FILL);
  assert.ok(sell.avgPrice! <= 100 && sell.avgPrice! > 99.95);
  // big buy: 1000 units * 100.2 = ~100k notional vs 5k ref → impact pushes price up
  const big = quoteFill("buy", 1000, q, DEFAULT_FILL);
  assert.ok(big.avgPrice! > small.avgPrice!);
});

test("quoteFill returns no fill when the touch side is missing", () => {
  const q: MarketQuote = { symbol: "X", bid: null, ask: null, last: 50 };
  assert.equal(quoteFill("buy", 1, q).avgPrice, null);
});

test("depthFill VWAPs across levels and reports slippage", () => {
  const book = { asks: [[100, 2] as [number, number], [101, 5] as [number, number]], bids: [] as [number, number][] };
  const r = depthFill("buy", 4, book); // 2@100 + 2@101 = 402 / 4 = 100.5
  assert.ok(Math.abs(r.avgPrice! - 100.5) < 1e-9);
  assert.ok(r.slippagePct > 0);
  assert.equal(r.fillQty, 4);
});

test("Account spot buy/sell tracks cash, units, realized PnL, fees", () => {
  const a = new Account("t", 10_000, { spotTakerPct: 0.1, perpTakerPct: 0.06 });
  a.applySpotFill("RAAPLUSDT", "buy", 10, 100); // cost 1000 + fee 1 => cash 8999
  assert.ok(Math.abs(a.cash - 8999) < 1e-9);
  assert.equal(a.spot.get("RAAPLUSDT")!.units, 10);
  a.applySpotFill("RAAPLUSDT", "sell", 10, 110); // +1100 - fee 1.1; realized ~ 10*(110-100)-1.1
  assert.ok(a.spot.get("RAAPLUSDT")!.units === 0);
  assert.ok(a.realizedPnl > 98 && a.realizedPnl < 99); // ~98.9 after fees
});

test("Account perp long realizes PnL into cash on close", () => {
  const a = new Account("t", 10_000);
  a.applyPerpFill("AAPLUSDT", "buy", 10, 100, 3); // open long
  a.applyPerpFill("AAPLUSDT", "sell", 10, 105, 3); // close +50 gross
  assert.equal(a.perp.get("AAPLUSDT")!.qty, 0);
  assert.ok(a.realizedPnl > 49 && a.realizedPnl <= 50);
  // equity back near start + profit - fees
  assert.ok(a.equity(new Map()) > 10_040 && a.equity(new Map()) < 10_050);
});

test("funding: long pays when rate positive", () => {
  const a = new Account("t", 10_000);
  a.applyPerpFill("AAPLUSDT", "buy", 10, 100);
  const pay = a.applyFunding("AAPLUSDT", 0.0001, 100); // 10*100*0.0001 = 0.1
  assert.ok(Math.abs(pay - 0.1) < 1e-9);
  assert.ok(a.fundingPaid > 0);
});

test("BitSim limit order rests then fills when market crosses", () => {
  const sim = new BitSim();
  sim.createAccount("a", 10_000);
  const o: Order = { id: "1", accountId: "a", symbol: "RAAPLUSDT", kind: "spot", side: "buy", type: "limit", qty: 5, limitPrice: 99, ts: 1 };
  const q1: MarketQuote = { symbol: "RAAPLUSDT", bid: 99.8, ask: 100.0, last: 99.9 };
  const f1 = sim.submit(o, q1); // ask 100 > limit 99 => rests
  assert.equal(f1.status, "pending");
  assert.equal(sim.pending.length, 1);
  const q2 = new Map<string, MarketQuote>([["RAAPLUSDT", { symbol: "RAAPLUSDT", bid: 98.7, ask: 98.9, last: 98.8 }]]);
  const fills = sim.onMarket(q2); // ask 98.9 <= 99 => fills, capped at 99
  assert.equal(fills.length, 1);
  assert.equal(fills[0].status, "filled");
  assert.ok(fills[0].avgPrice! <= 99);
  assert.equal(sim.pending.length, 0);
});

test("BitSim market order fills immediately via quote", () => {
  const sim = new BitSim();
  sim.createAccount("a", 10_000);
  const o: Order = { id: "2", accountId: "a", symbol: "RTSLAUSDT", kind: "spot", side: "buy", type: "market", qty: 2, ts: 1 };
  const q: MarketQuote = { symbol: "RTSLAUSDT", bid: 405, ask: 406, last: 405.5 };
  const f = sim.submit(o, q);
  assert.equal(f.status, "filled");
  assert.ok(f.avgPrice! >= 406);
});
