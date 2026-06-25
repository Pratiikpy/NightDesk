import { createHash } from "node:crypto";
import { BitSim } from "../bitsim/engine";
import type { Fill, MarketQuote, Order } from "../bitsim/types";
import { snapshotAccount, type AccountSnapshot } from "./account-reconciliation";
import type { VenueRules } from "./venue-rules";

export type ExecutionReplayEvent =
  | { sequence: number; ts: number; type: "MARKET"; quote: MarketQuote }
  | { sequence: number; ts: number; type: "ORDER"; order: Order }
  | { sequence: number; ts: number; type: "FUNDING" };

export interface ExecutionReplayResult {
  fills: Fill[];
  accounts: AccountSnapshot[];
  pending: Array<{ orderId: string; remainingQty: number }>;
  eventCount: number;
  fingerprint: string;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function replayExecution(input: {
  accounts: Array<{ id: string; cash: number }>;
  events: ExecutionReplayEvent[];
  venueRules?: Record<string, VenueRules>;
}): ExecutionReplayResult {
  const sim = new BitSim({ venueRules: input.venueRules });
  for (const account of input.accounts) sim.createAccount(account.id, account.cash);
  const quotes = new Map<string, MarketQuote>();
  let previousTs = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < input.events.length; index++) {
    const event = input.events[index]!;
    if (event.sequence !== index + 1) throw new Error(`execution replay sequence gap: expected ${index + 1}, got ${event.sequence}`);
    if (event.ts < previousTs) throw new Error("execution replay timestamp regression");
    previousTs = event.ts;
    if (event.type === "MARKET") {
      if (event.quote.symbol.length === 0) throw new Error("market event symbol is required");
      quotes.set(event.quote.symbol, structuredClone(event.quote));
      sim.onMarket(quotes);
    } else if (event.type === "ORDER") {
      const quote = quotes.get(event.order.symbol);
      if (!quote) throw new Error(`order has no prior market state: ${event.order.symbol}`);
      sim.submit({ ...event.order, ts: event.ts }, quote);
    } else {
      sim.applyFunding(quotes);
    }
  }

  const resultWithoutHash = {
    fills: sim.fills.map((fill) => structuredClone(fill)),
    accounts: [...sim.accounts.values()].map(snapshotAccount).sort((a, b) => a.accountId.localeCompare(b.accountId)),
    pending: sim.pending.map((pending) => ({ orderId: pending.order.id, remainingQty: pending.remainingQty })).sort((a, b) => a.orderId.localeCompare(b.orderId)),
    eventCount: input.events.length,
  };
  return { ...resultWithoutHash, fingerprint: fingerprint(resultWithoutHash) };
}
