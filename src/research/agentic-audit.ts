// Capability audit — agentic research loop. Verifies the plan's four exit criteria with
// deterministic fixtures (no network, no LLM): the research agent generates valid grounded DSL
// experiments without held-out access, the validator rejects unsafe experiments, ablation shows the
// agentic layer changes decisions vs a fixed policy, and memory retrieval is temporally valid and
// source-linked. Run: `npm run agentic:audit`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CouncilEvidenceFact } from "../council/grounding";
import { generateHypotheses } from "./hypothesis-agent";
import { validateStrategyDsl } from "./strategy-dsl";
import { ConvergenceMemory, premiumBucket } from "../memory/convergence";
import { runSimulation } from "../orchestrator/nightdesk";
import type { Snapshot, PegRow } from "../pegwatch/collect";
import type { EventContextProvider } from "../perception/events";

const ASOF = Date.parse("2026-06-14T14:00:00.000Z");

function ev(id: string, kind: CouncilEvidenceFact["kind"], value: string | number | boolean, observedAt: number, ttlMs = 300_000): CouncilEvidenceFact {
  return { id, kind, value, source: "agentic-audit", observedAt, expiresAt: observedAt + ttlMs, hash: "audit" };
}

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

const abstainProvider: EventContextProvider = {
  name: "agentic-audit-abstain",
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

interface Check { name: string; pass: boolean; detail: string }

export async function runAgenticMonth5Audit(): Promise<boolean> {
  const checks: Check[] = [];

  // 1. Agent generates valid, grounded DSL experiments without held-out access (point-in-time isolation).
  const evidence: CouncilEvidenceFact[] = [
    ev("event:magnitude_pct", "event", 1.0, ASOF),
    ev("market:premium_pct", "market", -0.97, ASOF),
    ev("market:fair_value", "market", 207, ASOF),
    // A FUTURE fact (observed after asOf) with a wildly different gap — must be IGNORED (no leakage).
    ev("market:premium_pct", "market", 9.9, ASOF + 60_000),
  ];
  const hyps = generateHypotheses({ evidence, asOf: ASOF });
  const allValid = hyps.length > 0 && hyps.every((h) => validateStrategyDsl(h.strategy).length === 0);
  const grounded = hyps.every((h) => h.citations.includes("event:magnitude_pct") && h.citations.includes("market:premium_pct"));
  const isolated = hyps.every((h) => h.strategy.signal.entryPct >= 0.3 && h.strategy.signal.entryPct <= 3); // derived from the ~0.97% as-of gap, never the 9.9% future fact
  checks.push({ name: "agent generates valid, grounded DSL experiments without held-out access", pass: allValid && grounded && isolated, detail: `${hyps.length} experiments; dsl-valid=${allValid}; grounded=${grounded}; point-in-time-isolated=${isolated}` });

  // ungrounded request → no experiment (the agent never invents a strategy without evidence).
  checks.push({ name: "ungrounded request yields no experiment", pass: generateHypotheses({ evidence: [], asOf: ASOF }).length === 0, detail: "empty evidence → 0 experiments" });

  // 2. Deterministic validator rejects malformed/unsafe proposals.
  const base = hyps[0]!.strategy;
  const oversize = validateStrategyDsl({ ...base, sizing: { ...base.sizing, notionalPct: 2 } });
  const disabledControls = validateStrategyDsl({ ...base, risk: { certificateRequired: false as unknown as true, hardGatesRequired: true } });
  checks.push({ name: "validator rejects unsafe DSL experiments (oversize, disabled risk controls)", pass: oversize.length > 0 && disabledControls.length > 0, detail: `oversize→[${oversize.join("; ")}] disabled-controls→[${disabledControls.join("; ")}]` });

  // 3. Ablation: the agentic event-aware layer changes the decision vs a fixed policy.
  const s0: Snapshot = { ts: ASOF, isoTime: new Date(ASOF).toISOString(), rows: [nvdaRow(205, 207)] };
  const s1: Snapshot = { ts: ASOF + 60_000, isoTime: new Date(ASOF + 60_000).toISOString(), rows: [nvdaRow(206.6, 207)] };
  const fixed = await runSimulation([s0, s1], { startCash: 100_000 });
  const agentic = await runSimulation([s0, s1], { startCash: 100_000, eventProvider: abstainProvider });
  checks.push({ name: "ablation: the agentic layer stands down on a catalyst the fixed policy trades", pass: fixed.scorecard.trades === 1 && agentic.scorecard.trades === 0 && agentic.scorecard.abstained === 1, detail: `fixed trades=${fixed.scorecard.trades}; agentic trades=${agentic.scorecard.trades}/abstained=${agentic.scorecard.abstained}` });

  // 4. Memory retrieval is temporally valid (no future leakage) and source-linked.
  const mem = new ConvergenceMemory();
  const t0 = ASOF;
  const t1 = ASOF + 86_400_000;
  mem.add({ ticker: "NVDA", ts: t1, bucket: premiumBucket(-0.97), premiumPct: -0.97, converged: true, narrowingPp: 0.8, pnlPct: 0.8, holdBars: 1 });
  const beforeFuture = mem.recall("NVDA", premiumBucket(-0.97), t0); // at t0 the t1 entry must be invisible
  mem.add({ ticker: "NVDA", ts: t0, bucket: premiumBucket(-0.97), premiumPct: -0.97, converged: true, narrowingPp: 0.8, pnlPct: 0.8, holdBars: 1 });
  const atT0 = mem.recall("NVDA", premiumBucket(-0.97), t0);
  const sourceLinked = mem.entries.every((e) => !!e.evidenceRef && !!e.sourceHash && e.expiresAt > e.ts);
  checks.push({ name: "memory retrieval is temporally valid (no future leakage) and source-linked", pass: beforeFuture.n === 0 && atT0.n === 1 && sourceLinked, detail: `recall@t0 before-future n=${beforeFuture.n}; after-add-t0 n=${atT0.n}; source-linked=${sourceLinked}` });

  const passed = checks.filter((c) => c.pass).length;
  const ok = passed === checks.length;
  const OUT = join(process.cwd(), "evidence", "agentic");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "agentic-audit.md"), [
    "# Agentic Research Loop",
    "",
    `Result: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`,
    "",
    "| Exit-gate requirement | Status | Detail |",
    "| --- | --- | --- |",
    ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`),
    "",
    "The agent proposes experiments from point-in-time evidence only; deterministic code validates, gates,",
    "and grades. No held-out outcome is visible to generation, and memory recall cannot leak the future.",
  ].join("\n") + "\n");

  console.log(`NIGHTDESK AGENTIC RESEARCH AUDIT: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`);
  for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

if (process.argv[1]?.endsWith("agentic-audit.ts")) runAgenticMonth5Audit();
