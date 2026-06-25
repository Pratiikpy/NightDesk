import test from "node:test";
import assert from "node:assert/strict";
import { parseEasternTimestamp, parseNasdaqInfo } from "../src/anchor/nasdaq";
import { resolveEquityAnchor } from "../src/anchor/resolver";
import type { EquityQuote, MarketState } from "../src/anchor/equity";

function quote(source: "yahoo" | "nasdaq", price: number, asOf: number | null, marketState: MarketState = "REGULAR"): EquityQuote {
  return { ticker: "NVDA", price, previousClose: 199, currency: "USD", marketState, asOf, source };
}

test("secondary equity parser extracts current price, status, and Eastern timestamp", () => {
  const parsed = parseNasdaqInfo("nvda", {
    data: {
      marketStatus: "Open",
      primaryData: { lastSalePrice: "$200.8707", lastTradeTimestamp: "Jun 24, 2026 10:46 AM ET" },
    },
  });
  assert.equal(parsed?.ticker, "NVDA");
  assert.equal(parsed?.price, 200.8707);
  assert.equal(parsed?.marketState, "REGULAR");
  assert.equal(parsed?.asOf, Date.parse("2026-06-24T14:46:00.000Z"));
  assert.equal(parseEasternTimestamp("bad"), null);
});

test("anchor resolver requires two fresh agreeing sources", () => {
  const now = 1_000_000;
  const result = resolveEquityAnchor("NVDA", [quote("yahoo", 100, now - 1_000), quote("nasdaq", 100.1, now - 500)], now);
  assert.equal(result.status, "consensus");
  assert.equal(result.tradeable, true);
  assert.equal(result.quote?.source, "consensus");
  assert.deepEqual(result.quote?.sources, ["yahoo", "nasdaq"]);
  assert.equal(result.quote?.price, 100.1, "freshest agreeing source is selected without inventing an average price");
});

test("single, stale, contradictory price, and contradictory market-state anchors fail closed", () => {
  const now = 1_000_000;
  assert.equal(resolveEquityAnchor("NVDA", [quote("yahoo", 100, now - 1_000)], now).status, "single_source");
  assert.equal(resolveEquityAnchor("NVDA", [quote("yahoo", 100, 1), quote("nasdaq", 100, 1)], now, { liveMaxAgeMs: 10 }).status, "stale");
  const priceConflict = resolveEquityAnchor("NVDA", [quote("yahoo", 100, now), quote("nasdaq", 110, now)], now);
  assert.equal(priceConflict.status, "contradiction");
  assert.equal(priceConflict.quote, null);
  const stateConflict = resolveEquityAnchor("NVDA", [quote("yahoo", 100, now, "REGULAR"), quote("nasdaq", 100, now, "CLOSED")], now);
  assert.equal(stateConflict.status, "contradiction");
  assert.equal(stateConflict.tradeable, false);
});

test("future-skewed anchors fail freshness checks", () => {
  const now = 1_000_000;
  const result = resolveEquityAnchor("NVDA", [quote("yahoo", 100, now + 500_000), quote("nasdaq", 100, now + 500_000)], now);
  assert.equal(result.status, "stale");
  assert.equal(result.tradeable, false);
});

test("missing market-state metadata does not contradict a fresh known source", () => {
  const now = 1_000_000;
  const result = resolveEquityAnchor("NVDA", [quote("yahoo", 100.05, now, "UNKNOWN"), quote("nasdaq", 100, now - 1_000, "REGULAR")], now);
  assert.equal(result.status, "consensus");
  assert.equal(result.tradeable, true);
  assert.equal(result.quote?.source, "consensus");
  assert.equal(result.quote?.marketState, "REGULAR", "known market state is preferred over a newer unknown-state observation");
  const noKnownState = resolveEquityAnchor("NVDA", [quote("yahoo", 100, now, "UNKNOWN"), quote("nasdaq", 100, now, "UNKNOWN")], now);
  assert.equal(noKnownState.status, "contradiction");
  assert.equal(noKnownState.tradeable, false);
});
