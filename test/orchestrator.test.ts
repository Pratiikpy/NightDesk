import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionFor } from "../src/orchestrator/session";
import { runSimulation } from "../src/orchestrator/nightdesk";
import type { Snapshot, PegRow } from "../src/pegwatch/collect";
import type { EventContextProvider } from "../src/perception/events";

// A Sunday (weekend), and a weekday RTH time, in ET.
const SUNDAY_MS = Date.parse("2026-06-14T14:00:00.000Z"); // Sun 10:00 ET
const WEEKDAY_RTH_MS = Date.parse("2026-06-15T17:00:00.000Z"); // Mon 13:00 ET
const WEEKDAY_OVERNIGHT_MS = Date.parse("2026-06-16T02:00:00.000Z"); // Mon 22:00 ET

test("sessionFor classifies weekend / RTH stand-down / overnight", () => {
  assert.equal(sessionFor(SUNDAY_MS).phase, "WEEKEND");
  assert.equal(sessionFor(SUNDAY_MS).newTradesAllowed, true);
  assert.equal(sessionFor(WEEKDAY_RTH_MS).phase, "STAND_DOWN");
  assert.equal(sessionFor(WEEKDAY_RTH_MS).newTradesAllowed, false);
  assert.equal(sessionFor(WEEKDAY_OVERNIGHT_MS).phase, "OVERNIGHT");
});

test("sessionFor handles NYSE holidays, DST, and early closes (correctness of the core thesis)", () => {
  // Juneteenth 2026 (Fri) — a full NYSE closure INSIDE the hackathon window. Must NOT be a trading day.
  const j = sessionFor(Date.parse("2026-06-19T17:00:00.000Z")); // 13:00 ET (EDT)
  assert.equal(j.phase, "HOLIDAY");
  assert.equal(j.isHoliday, true);
  // DST: the same 13:00 ET wall-clock is a different UTC instant in summer (EDT) vs winter (EST).
  assert.equal(sessionFor(Date.parse("2026-06-15T17:00:00.000Z")).etHour, 13); // EDT (UTC-4)
  assert.equal(sessionFor(Date.parse("2026-01-15T18:00:00.000Z")).etHour, 13); // EST (UTC-5)
  // Early close (day after Thanksgiving 2026): RTH ends 13:00 ET.
  assert.equal(sessionFor(Date.parse("2026-11-27T17:30:00.000Z")).phase, "STAND_DOWN"); // 12:30 ET → open
  assert.notEqual(sessionFor(Date.parse("2026-11-27T18:30:00.000Z")).phase, "STAND_DOWN"); // 13:30 ET → closed early
});

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
  };
}

test("runSimulation opens a convergence trade and grades it as a win when the premium narrows", async () => {
  // t0: rToken cheap (205) vs perp (207) → premium -0.97% STRETCHED → buy rToken
  // t1: rToken recovers to 206.6 vs perp 207 → premium -0.19% (converged up) → exit in profit
  const s0: Snapshot = { ts: SUNDAY_MS, isoTime: new Date(SUNDAY_MS).toISOString(), rows: [nvdaRow(205, 207)] };
  const s1: Snapshot = { ts: SUNDAY_MS + 60_000, isoTime: new Date(SUNDAY_MS + 60_000).toISOString(), rows: [nvdaRow(206.6, 207)] };

  const res = await runSimulation([s0, s1], { startCash: 100_000 });
  assert.equal(res.scorecard.trades, 1, JSON.stringify(res.scorecard));
  assert.equal(res.scorecard.graded, 1);
  assert.equal(res.scorecard.wins, 1);
  assert.equal(res.scorecard.convergenceCaptured, 1);
  assert.ok(res.equityEnd > res.equityStart, "equity should grow on a winning convergence");
  // ledger has the full chain
  const rec = res.ledger.records[0];
  assert.equal(rec.proposal.decision, "TRADE");
  assert.ok(rec.transcript.length === 7);
  assert.ok(rec.gateReport?.passed);
});

test("runSimulation takes no trade when premium is within the fee floor (NORMAL)", async () => {
  const s0: Snapshot = { ts: SUNDAY_MS, isoTime: "x", rows: [nvdaRow(206.9, 207)] }; // ~-0.05% NORMAL
  const res = await runSimulation([s0, s0], { startCash: 100_000 });
  assert.equal(res.scorecard.trades, 0);
});


test("event-aware abstention stands the desk down and grades the counterfactual", async () => {
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
  // gap converges 205 → 206.6 vs perp 207, but the desk abstains on the (stubbed) catalyst.
  const s0: Snapshot = { ts: SUNDAY_MS, isoTime: "x", rows: [nvdaRow(205, 207)] };
  const s1: Snapshot = { ts: SUNDAY_MS + 60_000, isoTime: "y", rows: [nvdaRow(206.6, 207)] };
  const res = await runSimulation([s0, s1], { startCash: 100_000, eventProvider: alwaysAbstain });

  assert.equal(res.scorecard.trades, 0, "no trades — the desk stood down");
  assert.equal(res.scorecard.abstained, 1);
  assert.equal(res.judgment.abstained.n, 1);
  const rec = res.ledger.records[0]!;
  assert.equal(rec.outcome, "abstained");
  assert.ok(rec.counterfactual, "abstained cycle carries a counterfactual grade");
  // the gap did converge here, so the abstention "missed" it — and we report that honestly
  assert.equal(rec.counterfactual!.wouldHaveConverged, true);
});


test("long-only by default: a rich rToken is WATCHED, not shorted (unless allowShorts)", async () => {
  // rToken 207 vs perp 205 → +0.98% rich → "short" direction.
  const s0: Snapshot = { ts: SUNDAY_MS, isoTime: "x", rows: [nvdaRow(207, 205)] };
  const s1: Snapshot = { ts: SUNDAY_MS + 60_000, isoTime: "y", rows: [nvdaRow(205.4, 205)] };
  const watched = await runSimulation([s0, s1], { startCash: 100_000 });
  assert.equal(watched.scorecard.trades, 0, "rich rToken is watched, not traded on a long-only desk");
  assert.equal(watched.scorecard.noTrades, 1);

  const shorted = await runSimulation([s0, s1], { startCash: 100_000, allowShorts: true });
  assert.equal(shorted.scorecard.trades, 1, "with allowShorts=true the rich rToken is shorted");
});


test("gradeAtOpen grades the off-hours entry at the first NYSE-open/RTH snapshot", async () => {
  const overnight = Date.parse("2026-06-16T02:00:00.000Z"); // Mon 22:00 ET → OVERNIGHT (trades allowed)
  const rth = Date.parse("2026-06-16T17:00:00.000Z"); // Mon 13:00 ET → RTH/STAND_DOWN (the open has passed)
  const s0: Snapshot = { ts: overnight, isoTime: "x", rows: [nvdaRow(205, 207)] }; // cheap → long
  const s1: Snapshot = { ts: rth, isoTime: "y", rows: [nvdaRow(206.6, 207)] }; // rToken recovered by RTH
  const res = await runSimulation([s0, s1], { startCash: 100_000, gradeAtOpen: true });
  assert.equal(res.gradedAtOpen, true, "graded at the open/RTH snapshot");
  assert.equal(res.scorecard.trades, 1);
  const graded = res.ledger.records.find((r) => r.gradePnl != null)!;
  assert.ok(Math.abs((graded.exitPrice ?? 0) - 206.6) < 1e-6, "exit price comes from the RTH snapshot");
});
