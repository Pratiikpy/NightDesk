import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYahooChart, yahooSymbol } from "../src/anchor/equity";

const fixture = {
  chart: {
    result: [
      {
        meta: {
          currency: "USD",
          symbol: "AAPL",
          regularMarketPrice: 291.13,
          chartPreviousClose: 307.34,
          regularMarketTime: 1781000000,
          marketState: "CLOSED",
        },
        indicators: { quote: [{ close: [301.54, 290.55, 291.58, 295.63, 291.13] }] },
      },
    ],
  },
};

test("parseYahooChart extracts price, previous close, state", () => {
  const q = parseYahooChart("AAPL", fixture);
  assert.ok(q);
  assert.equal(q!.price, 291.13);
  assert.equal(q!.previousClose, 307.34);
  assert.equal(q!.currency, "USD");
  assert.equal(q!.marketState, "CLOSED");
  assert.equal(q!.asOf, 1781000000 * 1000);
  assert.equal(q!.source, "yahoo");
});

test("parseYahooChart returns null on malformed / empty payloads", () => {
  assert.equal(parseYahooChart("X", {}), null);
  assert.equal(parseYahooChart("X", { chart: { result: [{ meta: {} }] } }), null);
  assert.equal(parseYahooChart("X", { chart: { result: [{ meta: { regularMarketPrice: 0 } }] } }), null);
});

test("marketState normalizes PRE/POST variants", () => {
  const pre = parseYahooChart("X", { chart: { result: [{ meta: { regularMarketPrice: 1, marketState: "PREPRE" } }] } });
  const post = parseYahooChart("X", { chart: { result: [{ meta: { regularMarketPrice: 1, marketState: "POSTPOST" } }] } });
  assert.equal(pre!.marketState, "PRE");
  assert.equal(post!.marketState, "POST");
});

test("yahooSymbol is identity-uppercase for US listings", () => {
  assert.equal(yahooSymbol("aapl"), "AAPL");
  assert.equal(yahooSymbol("SPY"), "SPY");
});
