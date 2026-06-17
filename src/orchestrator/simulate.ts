// `npm run simulate [file]` — run a full NightDesk night and print a graded scorecard.
// With a file: replay recorded snapshots. Without: collect a few live snapshots first.
import { collect } from "../pegwatch/collect";
import { loadSnapshots } from "../bitsim/market";
import { appendSnapshot } from "../recorder/store";
import { runSimulation, type SimResult } from "./nightdesk";
import { attributeGates } from "../ledger/scorecard";
import type { Snapshot } from "../pegwatch/collect";
import type { LLMProvider } from "../llm/provider";

export async function simulate(args: string[] = []): Promise<void> {
  const live = args.includes("--live");
  const fileArg = args.find((a) => !a.startsWith("--"));

  let llm: LLMProvider | undefined;
  if (live) {
    const { QwenProvider } = await import("../llm/qwen");
    llm = new QwenProvider();
    console.log("Council: LIVE qwen3.6-plus (via Bitget proxy)");
  } else {
    console.log("Council: offline deterministic (pass --live to use qwen3.6-plus)");
  }

  let snaps: Snapshot[];
  if (fileArg) {
    snaps = loadSnapshots(fileArg);
    console.log(`Replaying ${snaps.length} snapshot(s) from ${fileArg}`);
  } else {
    const N = 4;
    console.log(`Collecting ${N} live snapshots (~3s apart) for the simulation…`);
    snaps = [];
    for (let i = 0; i < N; i++) {
      const s = await collect();
      snaps.push(s);
      appendSnapshot(s);
      process.stdout.write(`  snapshot ${i + 1}/${N}\r`);
      if (i < N - 1) await new Promise((r) => setTimeout(r, 3000));
    }
    console.log("");
  }
  if (snaps.length === 0) {
    console.log("No snapshots available to simulate.");
    return;
  }

  const res = await runSimulation(snaps, {
    ...(llm ? { llm } : {}),
    gradeAtOpen: args.includes("--grade-at-open"),
    allowShorts: args.includes("--allow-shorts"),
  });
  printScorecard(res);
  console.log(res.gradedAtOpen ? "graded at the NYSE open (off-hours dislocation → open convergence)" : "graded at the final snapshot (pass --grade-at-open with an open-spanning recording to grade at the open)");
  const file = res.ledger.save();
  console.log(`\nLedger saved → ${file}`);
}

function printScorecard(res: SimResult): void {
  const s = res.scorecard;
  const pnlPct = ((res.equityEnd - res.equityStart) / res.equityStart) * 100;
  console.log("\n══════════ NightDesk — simulated night scorecard ══════════");
  console.log(`cycles=${s.cycles}  trades=${s.trades}  no-trade=${s.noTrades}  gated=${s.gated}  abstained=${s.abstained}`);
  console.log(`graded=${s.graded}  wins=${s.wins}  losses=${s.losses}  flats=${s.flats}  hit-rate=${s.hitRatePct}%`);
  console.log(`convergence captured=${s.convergenceCaptured}/${s.graded} (${s.convergenceRatePct}%)`);
  console.log(`  ↳ convergence = the gap narrowed; it is NOT P&L. The gap can close from either leg, and net P&L is after fills/fees. We treat capture% as a diagnostic, not edge.`);
  if (s.calibration) console.log(`council calibration: Brier ${s.calibration.brier} over n=${s.calibration.n} graded predictions (0=perfect, 0.25=always-50%; meaningful as n grows)`);
  const j = res.judgment;
  console.log(
    `judgment (counterfactual): traded converged ${j.tradedConvergedPct}% | abstained ${j.abstained.n} (would-have-converged ${j.abstained.wouldHaveConvergedPct}%, avg ${j.abstained.avgWouldBePnlPct}pp) | gated ${j.gated.n} (would-have-converged ${j.gated.wouldHaveConvergedPct}%, avg ${j.gated.avgWouldBePnlPct}pp)`
  );
  console.log(`gross graded PnL (pre-fee, per-cycle)=${s.totalSimPnl}  |  account equity (net, after fills) ${res.equityStart.toFixed(0)} → ${res.equityEnd.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(3)}%)`);
  console.log(`LLM tokens: prompt=${s.llmPromptTokens} completion=${s.llmCompletionTokens}`);
  if (Object.keys(s.gateBlockCounts).length) console.log(`gate blocks:`, s.gateBlockCounts);
  const attr = attributeGates(res.ledger.records);
  if (attr.length) {
    console.log(`gate value attribution (avg would-be PnL of the trades each gate blocked; negative = gate avoided losses):`);
    for (const a of attr) console.log(`  ${a.gate.padEnd(18)} blocked ${String(a.blocked).padStart(4)}  avg ${a.avgWouldBePnlPct >= 0 ? "+" : ""}${a.avgWouldBePnlPct}pp`);
  }
  const traded = res.ledger.records.filter((r) => r.gradePnl != null).slice(0, 6);
  if (traded.length) {
    console.log("\nsample graded cycles:");
    for (const r of traded) {
      console.log(
        `  ${r.ticker.padEnd(6)} ${r.side} ${r.symbol}  entry=${r.entryPrice?.toFixed(2)} exit=${r.exitPrice?.toFixed(2)}  premium ${r.entryPremiumPct?.toFixed(2)}%→${r.exitPremiumPct?.toFixed(2)}%  pnl=${r.gradePnl}  ${r.outcome}${r.convergenceCaptured ? " ✓conv" : ""}`
      );
    }
  }
  console.log("\n0 human interventions — complete loop, perception→council→gates→BitSim→grade.");
}
