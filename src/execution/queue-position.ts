import type { Side } from "../bitsim/types";

export interface QueuePosition {
  orderId: string;
  side: Side;
  price: number;
  originalQty: number;
  remainingQty: number;
  aheadQty: number;
  filledQty: number;
}

export interface AggressorTrade {
  side: Side;
  price: number;
  qty: number;
}

export function createQueuePosition(orderId: string, side: Side, price: number, qty: number, aheadQty: number): QueuePosition {
  if (![price, qty, aheadQty].every(Number.isFinite) || !(price > 0) || !(qty > 0) || aheadQty < 0) {
    throw new Error("invalid queue position");
  }
  return { orderId, side, price, originalQty: qty, remainingQty: qty, aheadQty, filledQty: 0 };
}

export function applyAggressorTrade(position: QueuePosition, trade: AggressorTrade): { position: QueuePosition; fillQty: number } {
  if (![trade.price, trade.qty].every(Number.isFinite) || !(trade.price > 0) || !(trade.qty > 0)) {
    throw new Error("invalid aggressor trade");
  }
  const reachesOrder = position.side === "buy"
    ? trade.side === "sell" && trade.price <= position.price
    : trade.side === "buy" && trade.price >= position.price;
  if (!reachesOrder || position.remainingQty <= 0) return { position: { ...position }, fillQty: 0 };

  const queueConsumed = Math.min(position.aheadQty, trade.qty);
  const afterQueue = trade.qty - queueConsumed;
  const fillQty = Math.min(position.remainingQty, afterQueue);
  return {
    fillQty,
    position: {
      ...position,
      aheadQty: position.aheadQty - queueConsumed,
      remainingQty: position.remainingQty - fillQty,
      filledQty: position.filledQty + fillQty,
    },
  };
}
