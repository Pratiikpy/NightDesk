import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDepegAlert, formatNightlyRecap, alertableRows, AlertBot } from "../src/face/alerts";
import type { PegRow } from "../src/pegwatch/collect";
import type { Scorecard } from "../src/ledger/scorecard";

function row(ticker: string, premiumPct: number, state: PegRow["state"], tradeable: boolean): PegRow {
  return { ticker, rToken: null, perp: null, ondo: null, premiumPct, state, tradeable, triangulation: null };
}

test("formatDepegAlert includes ticker, state, premium and the hashtag", () => {
  const a = formatDepegAlert(row("MSTR", -3.35, "DISLOCATED", true));
  assert.match(a, /rMSTR/);
  assert.match(a, /DISLOCATED/);
  assert.match(a, /-3.35%/);
  assert.match(a, /#BitgetHackathon/);
});

test("alertableRows keeps only tradeable non-normal rows, sorted by magnitude, capped", () => {
  const rows = [
    row("A", -0.1, "NORMAL", false),
    row("B", -0.9, "STRETCHED", true),
    row("C", 3.0, "DISLOCATED", true),
    row("D", -0.6, "STRETCHED", true),
  ];
  const picked = alertableRows(rows, 2);
  assert.deepEqual(picked.map((r) => r.ticker), ["C", "B"]);
});

test("nightly recap summarizes the scorecard", () => {
  const s: Scorecard = {
    cycles: 30, trades: 11, noTrades: 0, gated: 19, abstained: 0, graded: 11, wins: 6, losses: 5, flats: 0,
    hitRatePct: 54.5, convergenceCaptured: 7, convergenceRatePct: 63.6, totalSimPnl: 42.5,
    gateBlockCounts: {}, llmPromptTokens: 0, llmCompletionTokens: 0,
  };
  const r = formatNightlyRecap(s, "2026-06-14T00:00:00.000Z");
  assert.match(r, /54.5%/);
  assert.match(r, /0 human interventions/);
});

test("AlertBot dry-run buffers instead of sending", async () => {
  const bot = new AlertBot({ dryRun: true });
  await bot.send("hello");
  assert.equal(bot.sent.length, 1);
  assert.equal(bot.sent[0], "hello");
});
