import { test } from "node:test";
import assert from "node:assert/strict";
import { basisEventCards, basisConfidence, groundNumber, dedupeCards, type EventCard } from "../src/perception/eventcard";
import { NullPerceptionProvider, StaticPerceptionProvider, pollAll } from "../src/perception/provider";
import type { Snapshot, PegRow } from "../src/pegwatch/collect";

function row(partial: Partial<PegRow> & { ticker: string }): PegRow {
  return {
    ticker: partial.ticker,
    rToken: partial.rToken ?? { symbol: `R${partial.ticker}USDT`, bid: null, ask: null, last: null, mid: 100, ts: 1, bookLevels: 15 },
    perp: partial.perp ?? { symbol: `${partial.ticker}USDT`, bid: null, ask: null, last: null, mid: 100, ts: 1, funding: 0 },
    ondo: partial.ondo ?? null,
    premiumPct: partial.premiumPct ?? null,
    state: partial.state ?? null,
    tradeable: partial.tradeable ?? false,
    triangulation: partial.triangulation ?? null,
  };
}

const snap = (rows: PegRow[]): Snapshot => ({ ts: 1000, isoTime: "2026-06-14T00:00:00.000Z", rows });

test("basis cards only from tradeable, non-normal premiums", () => {
  const s = snap([
    row({ ticker: "NVDA", premiumPct: -0.9, state: "STRETCHED", tradeable: true }),
    row({ ticker: "AAPL", premiumPct: -0.1, state: "NORMAL", tradeable: false }), // skip
    row({ ticker: "MSTR", premiumPct: 0.2, state: "NORMAL", tradeable: false }), // skip
  ]);
  const cards = basisEventCards(s);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].tickers[0], "NVDA");
  assert.equal(cards[0].type, "basis");
});

test("direction: negative premium => long, positive => short", () => {
  const cards = basisEventCards(
    snap([
      row({ ticker: "NVDA", premiumPct: -0.9, state: "STRETCHED", tradeable: true }),
      row({ ticker: "GME", premiumPct: 2.5, state: "DISLOCATED", tradeable: true }),
    ])
  );
  const byTicker = Object.fromEntries(cards.map((c) => [c.tickers[0], c.directionHint]));
  assert.equal(byTicker["NVDA"], "long");
  assert.equal(byTicker["GME"], "short");
});

test("confidence grows with premium and book presence, bounded", () => {
  const low = basisConfidence(0.5, 0.32, false);
  const high = basisConfidence(3.0, 0.32, true);
  assert.ok(high > low);
  assert.ok(high <= 0.95);
  assert.ok(low >= 0.5);
});

test("numeric grounding tolerance", () => {
  assert.equal(groundNumber(100.5, 100, 1), true);
  assert.equal(groundNumber(102, 100, 1), false);
  assert.equal(groundNumber(0, 0), true);
});

test("dedupeCards keeps first by eventId", () => {
  const a: EventCard = { eventId: "x", type: "basis", tickers: ["A"], directionHint: "long", magnitudeEst: 1, confidence: 0.6, halfLifeMin: 60, sources: [], ts: 1 };
  const b: EventCard = { ...a, confidence: 0.9 };
  const merged = dedupeCards([a], [b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].confidence, 0.6);
});

test("pollAll aggregates providers and tolerates a throwing one", async () => {
  const good = new StaticPerceptionProvider("good", [
    { eventId: "e1", type: "news", tickers: ["AAPL"], directionHint: "long", magnitudeEst: 1, confidence: 0.7, halfLifeMin: 60, sources: ["x"], ts: 1 },
  ]);
  const bad: any = { name: "bad", poll: async () => { throw new Error("boom"); } };
  const cards = await pollAll([good, bad, new NullPerceptionProvider()], { phase: "OVERNIGHT", ts: 1 });
  assert.equal(cards.length, 1);
});
