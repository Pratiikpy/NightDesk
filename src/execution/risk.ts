import { createHash } from "node:crypto";
import type { Account } from "../bitsim/account";
import type { MarketQuote, Order, Side } from "../bitsim/types";
import type { OrderDeniedReason, TradingState } from "./events";

export interface CertifiedOrder extends Order {
  certificateId: string;
  maxNotionalUsd: number;
  reduceOnly?: boolean;
}

export interface RiskDecision {
  ok: boolean;
  reasonCode?: OrderDeniedReason;
  reason: string;
}

export function deterministicOrderId(parts: unknown[]): string {
  return "ord_" + createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

export class DuplicateOrderGuard {
  private readonly seen = new Set<string>();

  check(orderId: string): RiskDecision {
    if (this.seen.has(orderId)) return { ok: false, reasonCode: "DUPLICATE_ORDER", reason: "duplicate deterministic order id" };
    this.seen.add(orderId);
    return { ok: true, reason: "ok" };
  }
}

function sideWouldIncreaseSpot(symbol: string, side: Side, qty: number, account: Account): boolean {
  const units = account.spot.get(symbol)?.units ?? 0;
  if (side === "buy") return true;
  return qty > units + 1e-12;
}

export function validateCertifiedOrder(args: {
  order: CertifiedOrder;
  account: Account;
  quote?: MarketQuote;
  tradingState: TradingState;
  freeBalanceBufferUsd?: number;
}): RiskDecision {
  const { order, account, quote, tradingState } = args;
  if (tradingState === "HALTED") return { ok: false, reasonCode: "TRADING_HALTED", reason: "instrument state is HALTED" };
  if (order.qty <= 0 || !Number.isFinite(order.qty)) return { ok: false, reasonCode: "QUANTITY_PRECISION_INVALID", reason: "quantity must be positive and finite" };
  const touch = order.side === "buy" ? quote?.ask : quote?.bid;
  const mark = touch ?? quote?.last ?? order.limitPrice;
  if (mark == null || mark <= 0 || !Number.isFinite(mark)) return { ok: false, reasonCode: "NO_EXECUTABLE_QUOTE", reason: "no executable quote" };
  const notional = order.qty * mark;
  if (notional > order.maxNotionalUsd + 1e-9) return { ok: false, reasonCode: "NOTIONAL_EXCEEDS_RISK_LIMIT", reason: "order exceeds certificate/risk notional cap" };
  if (order.kind === "spot" && order.side === "buy" && notional > account.cash - (args.freeBalanceBufferUsd ?? 0) + 1e-9) {
    return { ok: false, reasonCode: "NOTIONAL_EXCEEDS_FREE_BALANCE", reason: "order exceeds free cash" };
  }
  if (order.kind === "spot" && order.side === "sell" && sideWouldIncreaseSpot(order.symbol, order.side, order.qty, account)) {
    return { ok: false, reasonCode: "NAKED_SPOT_SELL", reason: "spot sell would create a naked rToken short" };
  }
  if (order.reduceOnly && order.kind === "spot" && order.side === "buy") {
    return { ok: false, reasonCode: "WOULD_INCREASE_REDUCE_ONLY_POSITION", reason: "reduce-only spot order cannot buy" };
  }
  return { ok: true, reason: "ok" };
}

export function liquidityScore(quote?: MarketQuote): number {
  if (!quote) return 0;
  const bid = quote.bid ?? quote.last;
  const ask = quote.ask ?? quote.last;
  if (bid == null || ask == null || bid <= 0 || ask <= 0 || ask < bid) return 0;
  const mid = (bid + ask) / 2;
  const spreadBps = ((ask - bid) / mid) * 10_000;
  return Number(Math.max(0, Math.min(100, 100 - spreadBps)).toFixed(2));
}
