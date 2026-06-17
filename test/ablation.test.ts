import { test } from "node:test";
import assert from "node:assert/strict";
import { runAblation } from "../src/orchestrator/ablation";
import type { Snapshot, PegRow } from "../src/pegwatch/collect";
import type { EventContextProvider } from "../src/perception/events";

const SUNDAY_MS = Date.parse("2026-06-14T14:00:00.000Z"); // weekend, trades allowed

function nvdaRow(rtMid: number, perpMid: number): PegRow {
  const premium = ((rtMid - perpMid) / perpMid) * 100;
  const state = Math.abs(premium) > 2 ? "DISLOCATED" : Math.abs(premium) >= 0.5 ? "STRETCHED" : "NORMAL";
  return {
    ticker: "NVDA",
    rToken: { symbol: "RNVDAUSDT", bid: rtMid - 0.1, ask: rtMid + 0.1, last: rtMid, mid: rtMid, ts: 1, bookLevels: 15 },
    perp: { symbol: "NVDAUSDT", bid: perpMid - 0.1, ask: perpMid + 0.1, last: perpMid, mid: perpMid, ts: 1, funding: 0 },
    ondo: null,
    premiumPct: premium,
    state,
    tradeable: Math.abs(premium) > 0.32,
    triangulation: null,
  } as PegRow;
}

const alwaysAbstain: EventContextProvider = {
  name: "test-abstain",
  async contextFor(ticker: string) {
    return {
      ticker,
      macro: { active: false, date: "", events: [], severity: "low", summary: "" },
      news: { fresh: true, count: 1, relevantCount: 1, matched: ["earnings"], latestTitle: "x", summary: "catalyst" },
      severity: "high",
      abstainRecommended: true,
      summary: "NEWS catalyst",
    };
  },
};

test("ablation isolates the event-aware abstention layer: threshold trades, policy abstains", async () => {
  const s0: Snapshot = { ts: SUNDAY_MS, isoTime: "x", rows: [nvdaRow(205, 207)] };
  const s1: Snapshot = { ts: SUNDAY_MS + 60_000, isoTime: "y", rows: [nvdaRow(206.6, 207)] };
  const r = await runAblation([s0, s1], alwaysAbstain);

  assert.equal(r.threshold.trades, 1, "threshold policy trades the signal");
  assert.equal(r.policy.trades, 0, "abstention policy stands down");
  assert.equal(r.policy.abstained, 1);
  assert.ok(r.verdict.length > 0);
});

test("ablation with no event provider reduces to identical policies", async () => {
  const s0: Snapshot = { ts: SUNDAY_MS, isoTime: "x", rows: [nvdaRow(205, 207)] };
  const s1: Snapshot = { ts: SUNDAY_MS + 60_000, isoTime: "y", rows: [nvdaRow(206.6, 207)] };
  const r = await runAblation([s0, s1]);
  assert.equal(r.policy.abstained, 0);
  assert.equal(r.threshold.trades, r.policy.trades);
  assert.match(r.verdict, /No events fired/);
});
