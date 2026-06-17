// Pure fill models. No state, no I/O — fully unit-tested.
import type { Side, MarketQuote } from "./types";

export interface FillModelConfig {
  baseSlipPct: number; // always-applied slippage (half-spread proxy)
  impactPct: number; // extra slippage per 1× of reference notional consumed
  refNotional: number; // reference notional (USDT) for impact scaling
}
export const DEFAULT_FILL: FillModelConfig = { baseSlipPct: 0.0, impactPct: 0.05, refNotional: 5000 };

export interface QuoteResult {
  fillQty: number;
  avgPrice: number | null;
  slippagePct: number;
}

/**
 * Quote-driven fill (rTokens; also a fallback when no book is present).
 * Fills at the touch (ask for buy, bid for sell) plus size-aware slippage.
 */
export function quoteFill(side: Side, qty: number, q: MarketQuote, cfg: FillModelConfig = DEFAULT_FILL): QuoteResult {
  const touch = side === "buy" ? q.ask : q.bid;
  if (touch == null || touch <= 0 || qty <= 0) return { fillQty: 0, avgPrice: null, slippagePct: 0 };
  const notional = qty * touch;
  const impact = cfg.impactPct * (notional / cfg.refNotional);
  const slippagePct = cfg.baseSlipPct + impact;
  const dir = side === "buy" ? 1 : -1;
  const avgPrice = touch * (1 + dir * (slippagePct / 100));
  return { fillQty: qty, avgPrice, slippagePct };
}

/** Depth-aware VWAP fill across L2 levels (perps/Ondo when a book is present). */
export function depthFill(
  side: Side,
  qty: number,
  book: { bids: [number, number][]; asks: [number, number][] }
): QuoteResult {
  if (qty <= 0) return { fillQty: 0, avgPrice: null, slippagePct: 0 };
  const levels = side === "buy" ? book.asks : book.bids; // buy consumes asks, sell hits bids
  if (!levels || levels.length === 0) return { fillQty: 0, avgPrice: null, slippagePct: 0 };
  let remaining = qty;
  let cost = 0;
  let filled = 0;
  for (const [price, size] of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, size);
    cost += take * price;
    filled += take;
    remaining -= take;
  }
  if (filled === 0) return { fillQty: 0, avgPrice: null, slippagePct: 0 };
  const avgPrice = cost / filled;
  const touch = levels[0][0];
  const slippagePct = touch > 0 ? (((avgPrice - touch) / touch) * 100) * (side === "buy" ? 1 : -1) : 0;
  return { fillQty: filled, avgPrice, slippagePct };
}
