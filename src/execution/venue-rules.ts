import type { Order } from "../bitsim/types";

export interface VenueRules {
  tickSize: number;
  lotSize: number;
  minQty: number;
  maxQty?: number;
  minNotional: number;
  maxNotional?: number;
}

export interface VenueValidation {
  ok: boolean;
  reason?: "INVALID_NUMBER" | "PRICE_TICK" | "QUANTITY_LOT" | "QUANTITY_RANGE" | "NOTIONAL_RANGE";
}

function aligned(value: number, increment: number): boolean {
  if (!(increment > 0)) return false;
  const units = value / increment;
  return Math.abs(units - Math.round(units)) <= 1e-8;
}

export function validateVenueOrder(order: Order, referencePrice: number, rules: VenueRules): VenueValidation {
  const values = [order.qty, referencePrice, rules.tickSize, rules.lotSize, rules.minQty, rules.minNotional];
  if (values.some((value) => !Number.isFinite(value)) || !(order.qty > 0) || !(referencePrice > 0)) {
    return { ok: false, reason: "INVALID_NUMBER" };
  }
  if (order.limitPrice != null && (!Number.isFinite(order.limitPrice) || !(order.limitPrice > 0))) {
    return { ok: false, reason: "INVALID_NUMBER" };
  }
  if (order.limitPrice != null && !aligned(order.limitPrice, rules.tickSize)) {
    return { ok: false, reason: "PRICE_TICK" };
  }
  if (!aligned(order.qty, rules.lotSize)) return { ok: false, reason: "QUANTITY_LOT" };
  if (order.qty < rules.minQty || (rules.maxQty != null && order.qty > rules.maxQty)) {
    return { ok: false, reason: "QUANTITY_RANGE" };
  }
  const notional = order.qty * (order.limitPrice ?? referencePrice);
  if (notional < rules.minNotional || (rules.maxNotional != null && notional > rules.maxNotional)) {
    return { ok: false, reason: "NOTIONAL_RANGE" };
  }
  return { ok: true };
}
