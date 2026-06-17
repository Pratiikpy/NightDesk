// Agent benchmark arena — the honest "we win by losing less" proof.
//
// Five policies trade the SAME snapshots through the SAME fill + cost model; only the DECISION rule
// differs. The point is NOT that NightDesk earns the most (our edge test is null) — it is that the
// disciplined policy TRADES LESS, LOSES LESS, and avoids fake trades the reckless policies take.
//   • random      — coin-flip entry, random side (the baseline goblin)
//   • naive_gap    — trade every dislocation, both sides, no cost filter (reckless)
//   • perp_trust   — trade only on the rToken↔perp basis (the "trust the perp" trap — barely acts
//                    off-hours, because the perp hides the gap; the core-insight foil)
//   • news_blind   — trade every TRUE-gap dislocation, both sides, cost-gated, but ignores events
//   • nightdesk    — long-only fades, cost-gated (+ event abstention when a provider is supplied)
import type { Snapshot, PegRow } from "../pegwatch/collect";
import { mulberry32 } from "../history/study";
import { loadSnapshots } from "../bitsim/market";
import { collect } from "../pegwatch/collect";
import { certifyToken } from "./certify";
import { issueCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PerceptionContext } from "../perception/events";

const noEvents = (ticker: string): PerceptionContext => ({
  ticker,
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "" },
  severity: "none",
  abstainRecommended: false,
  summary: "",
});

export type PolicyName = "random" | "naive_gap" | "perp_trust" | "news_blind" | "momentum" | "nightdesk";

export interface PolicyResult {
  policy: PolicyName;
  trades: number;
  wins: number;
  losses: number; // "fake trades" — entries that lost money net of cost
  convergedPct: number; // of trades, % where the traded gap narrowed
  avgNetPnlPct: number; // mean per-trade PnL, net of round-trip cost
  totalNetPnlPct: number;
}

const STRETCH = 0.5; // |gap| below this is not a dislocation
const COST = 0.35; // round-trip cost: ~0.32% fee floor + a touch of slippage

interface Decision {
  side: "buy" | "sell";
  gap: number;
  gapKind: "equity" | "perp";
}

function trueGapOf(row: PegRow): number | null {
  return row.premiumVsEquityPct ?? null;
}

function decide(policy: PolicyName, row: PegRow, rand: () => number): Decision | null {
  const trueGap = trueGapOf(row);
  const perpGap = row.premiumPct ?? null;
  const eqGap = trueGap ?? perpGap; // prefer the true gap
  const eqKind: "equity" | "perp" = trueGap != null ? "equity" : "perp";
  switch (policy) {
    case "random": {
      if (eqGap == null || Math.abs(eqGap) < STRETCH) return null;
      if (rand() < 0.5) return null;
      return { side: rand() < 0.5 ? "buy" : "sell", gap: eqGap, gapKind: eqKind };
    }
    case "naive_gap": {
      if (eqGap == null || Math.abs(eqGap) < STRETCH) return null;
      return { side: eqGap < 0 ? "buy" : "sell", gap: eqGap, gapKind: eqKind };
    }
    case "perp_trust": {
      if (perpGap == null || Math.abs(perpGap) < STRETCH) return null;
      return { side: perpGap < 0 ? "buy" : "sell", gap: perpGap, gapKind: "perp" };
    }
    case "news_blind": {
      if (eqGap == null || Math.abs(eqGap) < STRETCH) return null;
      if (Math.abs(eqGap) - COST <= 0) return null; // cost-gated
      return { side: eqGap < 0 ? "buy" : "sell", gap: eqGap, gapKind: eqKind };
    }
    case "momentum": {
      // Trend-chaser: buys what's already rich, sells what's already cheap (the opposite of fading) —
      // the agent that gets run over when a dislocation mean-reverts.
      if (eqGap == null || Math.abs(eqGap) < STRETCH) return null;
      return { side: eqGap > 0 ? "buy" : "sell", gap: eqGap, gapKind: eqKind };
    }
    case "nightdesk": {
      if (eqGap == null || Math.abs(eqGap) < STRETCH) return null;
      if (eqGap > 0) return null; // long-only: rich rTokens aren't cleanly shortable → watch
      if (Math.abs(eqGap) - COST <= 0) return null; // net-edge gate
      return { side: "buy", gap: eqGap, gapKind: eqKind };
    }
  }
}

interface OpenPos {
  side: "buy" | "sell";
  gapKind: "equity" | "perp";
  entryLeg: number;
  entryGap: number;
}

function runPolicy(policy: PolicyName, snapshots: Snapshot[], seed: number, guard = false): PolicyResult & { blocked: number } {
  const rand = mulberry32(seed);
  const open = new Map<string, OpenPos>();
  const rejected = new Set<string>();
  for (const snap of snapshots) {
    for (const row of snap.rows) {
      if (open.has(row.ticker)) continue;
      const d = decide(policy, row, rand);
      if (!d) continue;
      const leg = d.side === "buy" ? row.rToken : row.perp;
      if (!leg || leg.mid == null || leg.mid <= 0) continue;
      if (guard) {
        // Proof-carrying: the intent must pass the firewall with a fresh certificate, or it's blocked.
        // Stale = NO usable anchor; off-hours last-close is the correct reference, not "stale".
        const stale = row.equity == null;
        const src = row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE";
        const cert = issueCertificate(certifyToken(row, noEvents(row.ticker)), { anchorSource: src, anchorStale: stale, ttlSec: 120 });
        if (evaluateIntent({ ticker: row.ticker, side: d.side, sizeUsd: 1000, certificate: cert }).verdict === "REJECT") {
          rejected.add(row.ticker);
          continue;
        }
      }
      open.set(row.ticker, { side: d.side, gapKind: d.gapKind, entryLeg: leg.mid, entryGap: d.gap });
    }
  }
  const blocked = [...rejected].filter((t) => !open.has(t)).length;
  const last = snapshots[snapshots.length - 1];
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let converged = 0;
  let pnlSum = 0;
  if (last) {
    for (const [ticker, pos] of open) {
      const row = last.rows.find((r) => r.ticker === ticker);
      const exitLeg = (pos.side === "buy" ? row?.rToken?.mid : row?.perp?.mid) ?? pos.entryLeg;
      const exitGap = (pos.gapKind === "equity" ? row?.premiumVsEquityPct : row?.premiumPct) ?? pos.entryGap;
      const dir = pos.side === "buy" ? 1 : -1;
      const net = (dir * (exitLeg - pos.entryLeg)) / pos.entryLeg * 100 - COST;
      trades++;
      pnlSum += net;
      if (net > 0) wins++;
      else losses++;
      if (Math.abs(exitGap) < Math.abs(pos.entryGap)) converged++;
    }
  }
  return {
    policy,
    trades,
    wins,
    losses,
    convergedPct: trades ? Number(((converged / trades) * 100).toFixed(1)) : 0,
    avgNetPnlPct: trades ? Number((pnlSum / trades).toFixed(3)) : 0,
    totalNetPnlPct: Number(pnlSum.toFixed(2)),
    blocked,
  };
}

export function runArena(snapshots: Snapshot[], seed = 12345): PolicyResult[] {
  const policies: PolicyName[] = ["random", "naive_gap", "perp_trust", "news_blind", "momentum", "nightdesk"];
  return policies.map((p) => runPolicy(p, snapshots, seed));
}

export function printArena(results: PolicyResult[]): void {
  console.log("\nNightDesk — agent benchmark arena (same market, same fills+cost; only the policy differs)\n");
  console.log("POLICY       trades  losers  converged  avgNet%/trade  totalNet%");
  console.log("-----------  ------  ------  ---------  -------------  ---------");
  for (const r of results) {
    console.log(
      r.policy.padEnd(11),
      String(r.trades).padStart(6),
      String(r.losses).padStart(6),
      (r.convergedPct + "%").padStart(9),
      ((r.avgNetPnlPct >= 0 ? "+" : "") + r.avgNetPnlPct).padStart(13),
      ((r.totalNetPnlPct >= 0 ? "+" : "") + r.totalNetPnlPct).padStart(9)
    );
  }
  const nd = results.find((r) => r.policy === "nightdesk");
  const naive = results.find((r) => r.policy === "naive_gap");
  if (nd && naive) {
    console.log(
      `\nNightDesk traded ${nd.trades} vs naive ${naive.trades} (${naive.trades - nd.trades} fewer), ` +
        `with ${nd.losses} losers vs ${naive.losses}. The point isn't more PnL — it's trading LESS and avoiding the bad trades.`
    );
  }
}

export async function arenaCommand(args: string[] = []): Promise<void> {
  const fileArg = args.find((a) => !a.startsWith("--"));
  let snaps: Snapshot[];
  if (fileArg) {
    snaps = loadSnapshots(fileArg);
    console.log(`Replaying ${snaps.length} snapshot(s) from ${fileArg}`);
  } else {
    const N = 4;
    console.log(`Collecting ${N} live snapshots (~3s apart) for the arena…`);
    snaps = [];
    for (let i = 0; i < N; i++) {
      snaps.push(await collect());
      if (i < N - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!snaps.length) {
    console.log("No snapshots to run the arena on.");
    return;
  }
  printArena(runArena(snaps));
}

// ── Adversarial gauntlet: reckless agents UNGUARDED vs FIREWALL-GUARDED ──
export interface GauntletRow {
  policy: PolicyName;
  unguarded: { trades: number; losers: number; totalNetPnlPct: number };
  guarded: { trades: number; blocked: number; losers: number; totalNetPnlPct: number };
}

export function runGauntlet(snapshots: Snapshot[], seed = 12345): GauntletRow[] {
  const policies: PolicyName[] = ["naive_gap", "perp_trust", "random", "momentum"];
  return policies.map((p) => {
    const u = runPolicy(p, snapshots, seed, false);
    const g = runPolicy(p, snapshots, seed, true);
    return {
      policy: p,
      unguarded: { trades: u.trades, losers: u.losses, totalNetPnlPct: u.totalNetPnlPct },
      guarded: { trades: g.trades, blocked: g.blocked, losers: g.losses, totalNetPnlPct: g.totalNetPnlPct },
    };
  });
}

export function printGauntlet(rows: GauntletRow[]): void {
  console.log("\nNightDesk — adversarial gauntlet: reckless agents UNGUARDED vs FIREWALL-GUARDED\n");
  console.log("AGENT        unguarded tr/losers/net%      guarded tr/blocked/losers/net%");
  console.log("-----------  ---------------------------  -------------------------------");
  for (const r of rows) {
    const u = `${r.unguarded.trades}/${r.unguarded.losers}/${r.unguarded.totalNetPnlPct >= 0 ? "+" : ""}${r.unguarded.totalNetPnlPct}`;
    const g = `${r.guarded.trades}/${r.guarded.blocked}/${r.guarded.losers}/${r.guarded.totalNetPnlPct >= 0 ? "+" : ""}${r.guarded.totalNetPnlPct}`;
    console.log(r.policy.padEnd(11), u.padEnd(27), g);
  }
  console.log("\nThe firewall rejects the trades these agents shouldn't take (shorts, non-tradeable, stale anchors) — guarded loses less. NightDesk is the gate, not another gambler.");
}

export async function gauntletCommand(args: string[] = []): Promise<void> {
  const fileArg = args.find((a) => !a.startsWith("--"));
  let snaps: Snapshot[];
  if (fileArg) {
    snaps = loadSnapshots(fileArg);
    console.log(`Replaying ${snaps.length} snapshot(s) from ${fileArg}`);
  } else {
    const N = 4;
    console.log(`Collecting ${N} live snapshots (~3s apart) for the gauntlet…`);
    snaps = [];
    for (let i = 0; i < N; i++) {
      snaps.push(await collect());
      if (i < N - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!snaps.length) {
    console.log("No snapshots to run the gauntlet on.");
    return;
  }
  printGauntlet(runGauntlet(snaps));
}
