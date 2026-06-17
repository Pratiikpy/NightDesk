import { test } from "node:test";
import assert from "node:assert/strict";
import { runArena, runGauntlet } from "../src/research/arena";
import { staleAnchor, runStress } from "../src/research/stress";
import type { Snapshot, PegRow } from "../src/pegwatch/collect";

function row(ticker: string, rMid: number, perpMid: number, trueGapPct: number): PegRow {
  return {
    ticker,
    rToken: { symbol: `R${ticker}USDT`, bid: rMid - 0.1, ask: rMid + 0.1, last: rMid, mid: rMid, ts: 1, bookLevels: 10 } as any,
    perp: { symbol: `${ticker}USDT`, bid: perpMid - 0.1, ask: perpMid + 0.1, last: perpMid, mid: perpMid, ts: 1, funding: 0 } as any,
    ondo: null,
    premiumPct: ((rMid - perpMid) / perpMid) * 100,
    state: "NORMAL",
    tradeable: true,
    triangulation: null,
    equity: { price: rMid / (1 + trueGapPct / 100), previousClose: 0, marketState: "CLOSED", asOf: 1 },
    premiumVsEquityPct: trueGapPct,
    stateVsEquity: Math.abs(trueGapPct) >= 0.5 ? "STRETCHED" : "NORMAL",
  } as PegRow;
}

test("arena: NightDesk is long-only and trades fewer than the reckless naive policy", () => {
  // AAPL cheap (-2% vs real, perp ~0); TSLA rich (+2% vs real, perp ~0).
  const rows: PegRow[] = [row("AAPL", 200, 200, -2), row("TSLA", 400, 400, +2)];
  const s0: Snapshot = { ts: 1, isoTime: "x", rows };
  const s1: Snapshot = { ts: 2, isoTime: "y", rows };
  const res = runArena([s0, s1]);
  const by = (p: string) => res.find((r) => r.policy === p)!;

  assert.equal(by("nightdesk").trades, 1, "long-only: trades only the cheap AAPL, watches rich TSLA");
  assert.equal(by("naive_gap").trades, 2, "naive trades both sides");
  assert.equal(by("perp_trust").trades, 0, "perp basis ~0 → perp-trusting trader sees nothing (the trap)");
  assert.ok(by("nightdesk").trades < by("naive_gap").trades, "disciplined desk trades less");
});


test("gauntlet: the firewall blocks the reckless agent's unsafe (rich/short) trades", () => {
  const rows: PegRow[] = [row("AAPL", 200, 200, -2), row("TSLA", 400, 400, +2)];
  const s0: Snapshot = { ts: 1, isoTime: "x", rows };
  const s1: Snapshot = { ts: 2, isoTime: "y", rows };
  const g = runGauntlet([s0, s1]);
  const naive = g.find((x) => x.policy === "naive_gap")!;
  assert.equal(naive.unguarded.trades, 2, "unguarded naive trades both sides");
  assert.ok(naive.guarded.blocked >= 1, "firewall blocks the rich/short intent");
  assert.ok(naive.guarded.trades <= naive.unguarded.trades, "guarded never trades more than unguarded");
});

test("stress lab: a stale anchor forces the firewall to block the reckless agent entirely", () => {
  // perp gaps non-trivial so naive_gap still decides (on the fallback), but the anchor is gone.
  const rows: PegRow[] = [row("AAPL", 200, 197, -2), row("TSLA", 400, 406, +2)];
  const stressed = staleAnchor([{ ts: 1, isoTime: "x", rows }, { ts: 2, isoTime: "y", rows }]);
  const naive = runGauntlet(stressed).find((x) => x.policy === "naive_gap")!;
  assert.equal(naive.guarded.trades, 0, "nothing trades on a stale anchor");
  assert.ok(naive.guarded.blocked >= 1, "the firewall blocked the stale-anchor intents");
});

test("stress lab: runStress reports all four scenarios", () => {
  const rows: PegRow[] = [row("AAPL", 200, 200, -2), row("TSLA", 400, 400, +2)];
  const out = runStress([{ ts: 1, isoTime: "x", rows }, { ts: 2, isoTime: "y", rows }]);
  assert.equal(out.length, 4);
  assert.ok(out.some((r) => r.scenario === "stale-anchor"));
});
