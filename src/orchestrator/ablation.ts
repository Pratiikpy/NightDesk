// Ablation: does the council's event-aware abstention layer add value, or is "trade every signal"
// just as good? We run the SAME snapshots through two policies and diff them honestly:
//   • THRESHOLD — trade every stretched-premium signal (NullEventProvider, no abstention).
//   • POLICY    — abstain on fresh news / high-severity macro (the council's actual differentiator).
// The offline council is deterministic, so this isolates exactly the abstention layer. We then use
// the counterfactual grade to ask: did the abstained gaps actually fail to converge (good judgment)
// or converge anyway (over-cautious)? We report whatever the data shows — no thumb on the scale.
import { runSimulation } from "./nightdesk";
import { loadSnapshots } from "../bitsim/market";
import { collect } from "../pegwatch/collect";
import type { Snapshot } from "../pegwatch/collect";
import type { EventContextProvider } from "../perception/events";

export interface AblationResult {
  cycles: number;
  threshold: { trades: number; convergedPct: number };
  policy: { trades: number; abstained: number; convergedPct: number; abstainedWouldHaveConvergedPct: number };
  verdict: string;
}

export async function runAblation(snapshots: Snapshot[], eventProvider?: EventContextProvider): Promise<AblationResult> {
  const thr = await runSimulation(snapshots, { startCash: 100_000 }); // NullEventProvider → trade every signal
  const pol = await runSimulation(snapshots, eventProvider ? { startCash: 100_000, eventProvider } : { startCash: 100_000 });

  const tConv = thr.scorecard.convergenceRatePct;
  const cConv = pol.scorecard.convergenceRatePct;
  const abstained = pol.scorecard.abstained;
  const abstainedWHC = pol.judgment.abstained.wouldHaveConvergedPct;

  let verdict: string;
  if (abstained === 0) {
    verdict =
      "No events fired on this data, so the policy reduced to the threshold (identical). The council's differentiator is event-aware abstention — run on a night with real news/macro (a recorded file) to see it act.";
  } else if (abstainedWHC < tConv) {
    verdict = `GOOD JUDGMENT — the ${abstained} abstained gap(s) converged only ${abstainedWHC}% of the time vs ${tConv}% for the traded ones: abstention avoided lower-quality setups.`;
  } else {
    verdict = `OVER-CAUTIOUS here — the ${abstained} abstained gap(s) would have converged ${abstainedWHC}% of the time: on this data abstention left convergence on the table. Reported honestly.`;
  }

  return {
    cycles: thr.scorecard.cycles,
    threshold: { trades: thr.scorecard.trades, convergedPct: tConv },
    policy: { trades: pol.scorecard.trades, abstained, convergedPct: cConv, abstainedWouldHaveConvergedPct: abstainedWHC },
    verdict,
  };
}

export function printAblation(r: AblationResult): void {
  console.log("\nNightDesk — ablation: event-aware abstention vs trade-every-signal\n");
  console.log(`cycles=${r.cycles}`);
  console.log(`THRESHOLD (trade every signal):      trades=${r.threshold.trades}  converged=${r.threshold.convergedPct}%`);
  console.log(`POLICY    (abstain on news/macro):   trades=${r.policy.trades}  abstained=${r.policy.abstained}  converged=${r.policy.convergedPct}%`);
  if (r.policy.abstained) console.log(`  of the abstained gap(s), ${r.policy.abstainedWouldHaveConvergedPct}% would have converged (lower = abstention was right)`);
  console.log(`\nVERDICT: ${r.verdict}`);
}

export async function ablationCommand(args: string[] = []): Promise<void> {
  const fileArg = args.find((a) => !a.startsWith("--"));
  let snaps: Snapshot[];
  if (fileArg) {
    snaps = loadSnapshots(fileArg);
    console.log(`Replaying ${snaps.length} snapshot(s) from ${fileArg}`);
  } else {
    const N = 4;
    console.log(`Collecting ${N} live snapshots (~3s apart) for the ablation…`);
    snaps = [];
    for (let i = 0; i < N; i++) {
      snaps.push(await collect());
      process.stdout.write(`  snapshot ${i + 1}/${N}\r`);
      if (i < N - 1) await new Promise((r) => setTimeout(r, 3000));
    }
    console.log("");
  }
  if (!snaps.length) {
    console.log("No snapshots to ablate.");
    return;
  }
  const { MarketEventProvider } = await import("../perception/events");
  printAblation(await runAblation(snaps, new MarketEventProvider()));
}
