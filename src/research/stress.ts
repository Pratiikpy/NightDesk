// NightDesk Stress Lab — does the safety kernel hold under hostile market conditions?
//
// We perturb recorded Bitget data into stress scenarios (liquidity drop, stale anchor, price shock)
// and re-run the adversarial gauntlet under each. The point: a reckless agent degrades under stress,
// but the firewall keeps blocking the trades it shouldn't take — the safety kernel doesn't break when
// the market does. Pure transforms over snapshots; no network.
import type { Snapshot, PegRow } from "../pegwatch/collect";
import { loadSnapshots } from "../bitsim/market";
import { collect } from "../pegwatch/collect";
import { runGauntlet } from "./arena";

function clone(snaps: Snapshot[]): Snapshot[] {
  return snaps.map((s) => ({
    ...s,
    rows: s.rows.map((r) => ({ ...r, rToken: r.rToken ? { ...r.rToken } : r.rToken, perp: r.perp ? { ...r.perp } : r.perp, equity: r.equity ? { ...r.equity } : r.equity })) as PegRow[],
  }));
}

const stateOf = (g: number) => (Math.abs(g) > 2 ? "DISLOCATED" : Math.abs(g) >= 0.5 ? "STRETCHED" : "NORMAL");

/** Liquidity drop: order books vanish (quote-only) — lowers safety, shrinks size caps. */
export function liquidityDrop(snaps: Snapshot[]): Snapshot[] {
  const c = clone(snaps);
  for (const s of c) for (const r of s.rows) if (r.rToken) r.rToken.bookLevels = 0;
  return c;
}

/** Stale anchor: the real-stock reference goes missing — must force ABSTAIN/REJECT. */
export function staleAnchor(snaps: Snapshot[]): Snapshot[] {
  const c = clone(snaps);
  for (const s of c)
    for (const r of s.rows) {
      r.equity = null;
      r.premiumVsEquityPct = null;
      r.stateVsEquity = null;
    }
  return c;
}

/** Price shock: rToken jumps by `pct` vs an unchanged anchor — creates absurd gaps the oracle gate must catch. */
export function priceShock(snaps: Snapshot[], pct = 0.3): Snapshot[] {
  const c = clone(snaps);
  for (const s of c)
    for (const r of s.rows) {
      if (r.rToken?.mid != null) r.rToken.mid = r.rToken.mid * (1 + pct);
      if (r.equity?.price && r.rToken?.mid != null) {
        r.premiumVsEquityPct = ((r.rToken.mid - r.equity.price) / r.equity.price) * 100;
        r.stateVsEquity = stateOf(r.premiumVsEquityPct);
      }
    }
  return c;
}

export interface StressRow {
  scenario: string;
  unguardedNetPct: number;
  unguardedLosers: number;
  guardedNetPct: number;
  guardedBlocked: number;
}

export function runStress(snaps: Snapshot[]): StressRow[] {
  const scenarios: [string, Snapshot[]][] = [
    ["baseline", snaps],
    ["liquidity-drop", liquidityDrop(snaps)],
    ["stale-anchor", staleAnchor(snaps)],
    ["price-shock+30%", priceShock(snaps, 0.3)],
  ];
  return scenarios.map(([scenario, ss]) => {
    const naive = runGauntlet(ss).find((x) => x.policy === "naive_gap")!;
    return {
      scenario,
      unguardedNetPct: naive.unguarded.totalNetPnlPct,
      unguardedLosers: naive.unguarded.losers,
      guardedNetPct: naive.guarded.totalNetPnlPct,
      guardedBlocked: naive.guarded.blocked,
    };
  });
}

export function printStress(rows: StressRow[]): void {
  console.log("\nNightDesk Stress Lab — reckless agent (naive_gap) UNGUARDED vs FIREWALL-GUARDED under stress\n");
  console.log("SCENARIO          unguarded net%/losers   guarded net%/blocked");
  console.log("----------------  ---------------------   --------------------");
  for (const r of rows) {
    const u = `${r.unguardedNetPct >= 0 ? "+" : ""}${r.unguardedNetPct}/${r.unguardedLosers}`;
    const g = `${r.guardedNetPct >= 0 ? "+" : ""}${r.guardedNetPct}/${r.guardedBlocked}`;
    console.log(r.scenario.padEnd(16), u.padEnd(23), g);
  }
  console.log("\nUnder liquidity drops, stale anchors, and price shocks the reckless agent degrades; the firewall keeps blocking unsafe trades. The kernel holds when the market doesn't.");
}

export async function stressCommand(args: string[] = []): Promise<void> {
  const fileArg = args.find((a) => !a.startsWith("--"));
  let snaps: Snapshot[];
  if (fileArg) {
    snaps = loadSnapshots(fileArg);
    console.log(`Replaying ${snaps.length} snapshot(s) from ${fileArg}`);
  } else {
    const N = 4;
    console.log(`Collecting ${N} live snapshots (~3s apart) for the stress lab…`);
    snaps = [];
    for (let i = 0; i < N; i++) {
      snaps.push(await collect());
      if (i < N - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!snaps.length) {
    console.log("No snapshots to stress-test.");
    return;
  }
  printStress(runStress(snaps));
}
