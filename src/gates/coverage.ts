import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { preTradeGates, liveGates, type Proposal, type PreTradeCtx } from "./gates";

const proposal: Proposal = {
  ticker: "NVDA",
  instrument: "perp",
  side: "buy",
  sizePct: 5,
  expectedEdgePct: 1,
  effectiveLeverage: 2,
  stop: 200,
  isBasisArb: false,
};

const ctx: PreTradeCtx = {
  existingTickerPct: 0,
  grossPct: 10,
  pegState: "STRETCHED",
  estSlippagePct: 0.1,
  eventConfidence: 0.8,
  numericGroundingPassed: true,
  correlatedOpenCount: 0,
  feeRoundTripPct: 0.32,
  dataAgeSec: 5,
  killSwitch: false,
  estVolPct: 1,
  anchorDeviationPct: 1,
};

function csv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0] ?? {});
  return [headers.join(","), ...rows.map((r) => headers.map((h) => String(r[h] ?? "").replaceAll(",", ";")).join(","))].join("\n") + "\n";
}

export function runGatesCoverage(): void {
  const pass = preTradeGates(proposal, ctx);
  const scenarios = [
    { gate: "12_kill_switch", report: preTradeGates(proposal, { ...ctx, killSwitch: true }) },
    { gate: "11_stale_data", report: preTradeGates(proposal, { ...ctx, dataAgeSec: 120 }) },
    { gate: "1_max_position", report: preTradeGates({ ...proposal, sizePct: 8 }, { ...ctx, existingTickerPct: 5 }) },
    { gate: "2_max_gross", report: preTradeGates({ ...proposal, sizePct: 45 }, { ...ctx, grossPct: 10 }) },
    { gate: "3_depeg", report: preTradeGates(proposal, { ...ctx, pegState: "DISLOCATED" }) },
    { gate: "4_liquidity", report: preTradeGates(proposal, { ...ctx, estSlippagePct: 0.9 }) },
    { gate: "5_event_confidence", report: preTradeGates(proposal, { ...ctx, eventConfidence: 0.2 }) },
    { gate: "6_leverage", report: preTradeGates({ ...proposal, effectiveLeverage: 5 }, ctx) },
    { gate: "7_correlation", report: preTradeGates(proposal, { ...ctx, correlatedOpenCount: 3 }) },
    { gate: "13_net_edge", report: preTradeGates({ ...proposal, expectedEdgePct: 0.1 }, ctx) },
    { gate: "14_var", report: preTradeGates({ ...proposal, sizePct: 10 }, { ...ctx, estVolPct: 10 }) },
    { gate: "15_oracle_deviation", report: preTradeGates(proposal, { ...ctx, anchorDeviationPct: 40 }) },
  ];
  const liveScenarios = [
    { gate: "8_stop_loss", passed: liveGates({ positions: [{ ticker: "NVDA", side: "buy", entry: 210, stop: 200, mark: 199 }], dailyPnlPct: 0, isPreOpenCutoff: false, dataAgeSec: 1, killSwitch: false }).some((a) => a.type === "stop_loss") },
    { gate: "9_daily_drawdown", passed: liveGates({ positions: [{ ticker: "NVDA", side: "buy", entry: 1, mark: 1 }], dailyPnlPct: -4, isPreOpenCutoff: false, dataAgeSec: 1, killSwitch: false }).some((a) => a.type === "daily_drawdown_flatten") },
    { gate: "10_flat_by_open", passed: liveGates({ positions: [{ ticker: "NVDA", side: "buy", entry: 1, mark: 1 }], dailyPnlPct: 0, isPreOpenCutoff: true, dataAgeSec: 1, killSwitch: false }).some((a) => a.type === "flat_by_open") },
  ];
  const rows = pass.results.map((r) => {
    const fail = scenarios.find((s) => s.gate === r.gate)?.report.results.find((x) => x.gate === r.gate);
    return { gate: r.gate, pass_case: r.passed, fail_case: fail ? !fail.passed : false, fail_reason: fail?.detail ?? "" };
  });
  for (const l of liveScenarios) rows.push({ gate: l.gate, pass_case: true, fail_case: l.passed, fail_reason: l.passed ? "live action emitted" : "missing live action" });
  const ok = rows.length === 15 && rows.every((r) => r.pass_case && r.fail_case && r.fail_reason);
  const out = join(process.cwd(), "evidence", "gates");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "gate-coverage.csv"), csv(rows));
  writeFileSync(join(out, "gate-coverage.md"), [
    "# Gate Coverage",
    "",
    `Status: ${ok ? "PASS" : "FAIL"}`,
    "",
    "| Gate | Pass Case | Fail Case | Fail Reason |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.gate} | ${r.pass_case} | ${r.fail_case} | ${r.fail_reason} |`),
    "",
  ].join("\n"));
  console.log(`NIGHTDESK GATES COVERAGE ${ok ? "PASS" : "FAIL"}`);
  console.log(`gates=${rows.length}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("coverage.ts")) runGatesCoverage();
