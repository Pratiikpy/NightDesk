import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVenueOrder, type VenueRules } from "../src/execution/venue-rules";
import type { Order } from "../src/bitsim/types";

const rules: VenueRules = { tickSize: 0.01, lotSize: 0.001, minQty: 0.01, maxQty: 100, minNotional: 5, maxNotional: 10_000 };
const base: Order = { id: "o", accountId: "a", symbol: "X", kind: "spot", side: "buy", type: "limit", qty: 1, limitPrice: 100, ts: 1 };

test("venue rules accept aligned orders and reject each venue boundary", () => {
  assert.equal(validateVenueOrder(base, 100, rules).ok, true);
  assert.equal(validateVenueOrder({ ...base, limitPrice: 100.005 }, 100, rules).reason, "PRICE_TICK");
  assert.equal(validateVenueOrder({ ...base, qty: 1.0005 }, 100, rules).reason, "QUANTITY_LOT");
  assert.equal(validateVenueOrder({ ...base, qty: 0.005 }, 100, rules).reason, "QUANTITY_RANGE");
  assert.equal(validateVenueOrder({ ...base, qty: 101 }, 100, rules).reason, "QUANTITY_RANGE");
  assert.equal(validateVenueOrder({ ...base, qty: 0.01, limitPrice: 100 }, 100, rules).reason, "NOTIONAL_RANGE");
});

test("venue rules fail closed on NaN and Infinity", () => {
  assert.equal(validateVenueOrder({ ...base, qty: Number.NaN }, 100, rules).reason, "INVALID_NUMBER");
  assert.equal(validateVenueOrder({ ...base, limitPrice: Number.POSITIVE_INFINITY }, 100, rules).reason, "INVALID_NUMBER");
});
