import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSnapshot } from "../src/data/snapshot-normalizer";
import type { Snapshot } from "../src/pegwatch/collect";

test("snapshot normalizer emits provenance-rich quote, book, perp, and equity events", () => {
  const snapshot: Snapshot = {
    ts: 1_000,
    isoTime: new Date(1_000).toISOString(),
    rows: [{
      ticker: "NVDA",
      rToken: { symbol: "RNVDAUSDT", bid: 99, ask: 100, last: 99.5, mid: 99.5, ts: 990, bookLevels: 1, book: { bids: [[99, 2]], asks: [[100, 2]] } },
      perp: { symbol: "NVDAUSDT", bid: 100, ask: 101, last: 100.5, mid: 100.5, ts: 995, funding: 0 },
      ondo: null,
      premiumPct: -1,
      state: "NORMAL",
      tradeable: true,
      triangulation: null,
      equity: { price: 102, previousClose: 101, marketState: "CLOSED", asOf: 900 },
      premiumVsEquityPct: -2.45,
      stateVsEquity: "DISLOCATED",
    }],
  };
  const events = normalizeSnapshot(snapshot);
  assert.deepEqual(events.map((event) => event.kind), ["market.quote", "market.book", "market.quote", "equity.quote"]);
  assert.ok(events.every((event) => event.schemaVersion === "nightdesk.data.v1"));
  assert.ok(events.every((event) => event.instrument === "NVDA"));
  assert.ok(events.every((event) => /^[a-f0-9]{64}$/.test(event.payloadHash)));
});
