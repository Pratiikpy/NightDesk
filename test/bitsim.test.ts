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

test("depthFill never consumes liquidity beyond a limit price", () => {
  const book = {
    asks: [[100, 2], [101, 5]] as [number, number][],
    bids: [] as [number, number][],
  };
  const result = depthFill("buy", 4, book, 100);
  assert.equal(result.fillQty, 2);
  assert.equal(result.avgPrice, 100);
});

test("quoteFill caps execution at visible touch size", () => {
  const q: MarketQuote = { symbol: "X", bid: 99, ask: 100, last: 99.5, askSz: 2 };
  const result = quoteFill("buy", 5, q);
  assert.equal(result.fillQty, 2);
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

test("BitSim keeps the unfilled remainder of a partially filled limit order", () => {
  const sim = new BitSim();
  sim.createAccount("a", 10_000);
  const order: Order = {
    id: "partial-limit",
    accountId: "a",
    symbol: "RAAPLUSDT",
    kind: "spot",
    side: "buy",
    type: "limit",
    qty: 5,
    limitPrice: 100,
    ts: 1,
  };
  const first = sim.submit(order, { symbol: order.symbol, bid: 99, ask: 100, last: 100, askSz: 2 });
  assert.equal(first.status, "partial");
  assert.equal(first.qty, 2);
  assert.equal(sim.pending.length, 1);
  assert.equal(sim.pending[0]!.remainingQty, 3);

  const second = sim.onMarket(new Map([[order.symbol, { symbol: order.symbol, bid: 99, ask: 100, last: 100, askSz: 3 }]]));
  assert.equal(second[0]!.status, "filled");
  assert.equal(second[0]!.qty, 3);
  assert.equal(sim.pending.length, 0);
});

test("BitSim rejects invalid venue tick, lot, and notional before accounting", () => {
  const rules = { tickSize: 0.1, lotSize: 0.01, minQty: 0.01, minNotional: 5 };
  const sim = new BitSim({ venueRules: { RAAPLUSDT: rules } });
  const account = sim.createAccount("a", 10_000);
  const q: MarketQuote = { symbol: "RAAPLUSDT", bid: 99.9, ask: 100, last: 100 };
  const badTick = sim.submit({ id: "tick", accountId: "a", symbol: q.symbol, kind: "spot", side: "buy", type: "limit", qty: 1, limitPrice: 100.05, ts: 1 }, q);
  const badLot = sim.submit({ id: "lot", accountId: "a", symbol: q.symbol, kind: "spot", side: "buy", type: "market", qty: 1.005, ts: 1 }, q);
  const tooSmall = sim.submit({ id: "small", accountId: "a", symbol: q.symbol, kind: "spot", side: "buy", type: "market", qty: 0.01, ts: 1 }, q);
  assert.match(badTick.reason!, /PRICE_TICK/);
  assert.match(badLot.reason!, /QUANTITY_LOT/);
  assert.match(tooSmall.reason!, /NOTIONAL_RANGE/);
  assert.equal(account.cash, 10_000);
});

test("BitSim rejects naked spot sells and overspending buys", () => {
  const sim = new BitSim();
  const account = sim.createAccount("a", 10);
  const q: MarketQuote = { symbol: "RAAPLUSDT", bid: 99, ask: 100, last: 100 };
  const sell = sim.submit({ id: "sell", accountId: "a", symbol: q.symbol, kind: "spot", side: "sell", type: "market", qty: 1, ts: 1 }, q);
  const buy = sim.submit({ id: "buy", accountId: "a", symbol: q.symbol, kind: "spot", side: "buy", type: "market", qty: 1, ts: 1 }, q);
  assert.equal(sell.reason, "insufficient spot position");
  assert.equal(buy.reason, "insufficient cash");
  assert.equal(account.cash, 10);
});

test("BitSim resting limits fill only after aggressor volume clears queue ahead", () => {
  const sim = new BitSim();
  const account = sim.createAccount("a", 10_000);
  const order: Order = { id: "queued", accountId: "a", symbol: "RAAPLUSDT", kind: "spot", side: "buy", type: "limit", qty: 5, limitPrice: 99, ts: 1 };
  const resting: MarketQuote = { symbol: order.symbol, bid: 99, ask: 100, last: 99, bidSz: 3, askSz: 10 };
  assert.equal(sim.submit(order, resting).status, "pending");
  assert.equal(sim.pending[0]!.queue!.aheadQty, 3);

  const first = sim.onMarket(new Map([[order.symbol, { ...resting, lastTradeSide: "sell", lastTradeQty: 2 }]]));
  assert.equal(first.length, 0);
  assert.equal(sim.pending[0]!.queue!.aheadQty, 1);

  const second = sim.onMarket(new Map([[order.symbol, { ...resting, lastTradeSide: "sell", lastTradeQty: 4 }]]));
  assert.equal(second.length, 1);
  assert.equal(second[0]!.qty, 3);
  assert.equal(second[0]!.status, "partial");
  assert.equal(sim.pending[0]!.remainingQty, 2);
  assert.equal(account.spot.get(order.symbol)!.units, 3);
});
