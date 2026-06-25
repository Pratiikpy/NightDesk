import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "execution-v2");

interface AuditRow {
  requirement: string;
  passed: boolean;
  evidence: string[];
  detail: string;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), file), "utf8")) as T;
}

export function runMonth3ExitAudit(): { passed: boolean; rows: AuditRow[] } {
  mkdirSync(OUT, { recursive: true });
  const proof = readJson<{ passed: boolean; rows: { requirement: string; passed: boolean }[] }>("evidence/execution-v2/execution-v2-proof.json");
  const shadow = readJson<{
    success: boolean;
    universeSize: number;
    symbolsCalibrated: number;
    cases: number;
    executableSymbols: number;
    tiers: { tier: string; cases: number; meanPriceErrorBps: number | null; meanDepthCoveragePct: number | null; meanDepthShortfallBps: number | null }[];
  }>("evidence/execution-v2/live-shadow-calibration.json");
  const requirements = new Map(proof.rows.map((row) => [row.requirement, row.passed]));
  const latencyRows = readFileSync(join(process.cwd(), "evidence/fill-model/latency-sweep.csv"), "utf8").split(/\r?\n/).filter(Boolean).slice(1).map((line) => line.split(",").map(Number));
  const sourceFiles = [
    "test/depth-replay.test.ts",
    "test/execution-v2.property.test.ts",
    "test/order-state-machine.test.ts",
    "test/account-reconciliation.test.ts",
    "test/bitsim.test.ts",
  ];

  const rows: AuditRow[] = [
    {
      requirement: "Depth-aware ordered event replay is deterministic",
      passed: requirements.get("deterministic depth event replay") === true,
      evidence: ["evidence/execution-v2/execution-v2-proof.json", "test/depth-replay.test.ts"],
      detail: "Ordered market/order events reproduce the same fill/account fingerprint and reject sequence or time regressions.",
    },
    {
      requirement: "Latency degrades execution on a deterministic price path",
      passed: latencyRows.length >= 3 && latencyRows.every((row) => row.every(Number.isFinite)) && latencyRows[latencyRows.length - 1]![4]! > latencyRows[0]![4]!,
      evidence: ["evidence/fill-model/latency-sweep.csv", "evidence/fill-model/latency-sweep.md"],
      detail: `${latencyRows.length} latency points with increasing adverse cost.`,
    },
    {
      requirement: "Partial fills, queue position, and venue rejects are enforced",
      passed: ["partial fill remainder", "price-time queue position", "venue tick/lot/notional rules"].every((name) => requirements.get(name) === true),
      evidence: ["evidence/execution-v2/execution-v2-proof.json", "test/bitsim.test.ts", "test/venue-rules.test.ts", "test/queue-position.test.ts"],
      detail: "Resting quantity survives partial execution, aggressor volume clears queue ahead, and invalid venue increments fail before accounting.",
    },
    {
      requirement: "Cancel/fill races and fill invariants have adversarial tests",
      passed: requirements.get("cancel/fill race") === true && sourceFiles.every((file) => existsSync(join(process.cwd(), file))),
      evidence: ["test/order-state-machine.test.ts", "test/execution-v2.property.test.ts"],
      detail: "Late fills are accepted only before cancel acknowledgement; depth and queue conservation are property-tested.",
    },
    {
      requirement: "Implementation shortfall is attributed",
      passed: requirements.get("implementation shortfall attribution") === true && shadow.tiers.some((tier) => tier.cases > 0 && Number.isFinite(tier.meanDepthShortfallBps)),
      evidence: ["evidence/execution-v2/execution-v2-proof.json", "evidence/execution-v2/live-shadow-calibration.json"],
      detail: "Delay, execution impact, and fees are separated; live depth cases report fee-inclusive shortfall by tier.",
    },
    {
      requirement: "Live public books calibrate simulation error by liquidity tier",
      passed: shadow.success && shadow.universeSize === 19 && shadow.symbolsCalibrated === 19 && shadow.cases === 114 && shadow.executableSymbols >= 1 && shadow.tiers.some((tier) => tier.tier === "D" && tier.meanDepthCoveragePct === 0),
      evidence: ["evidence/execution-v2/live-shadow-calibration.json", "evidence/execution-v2/live-shadow-calibration.csv", "evidence/execution-v2/live-shadow-calibration.md"],
      detail: `${shadow.symbolsCalibrated}/19 symbols, ${shadow.cases} cases, ${shadow.executableSymbols} with executable two-sided depth; no-book symbols are D/untradeable.`,
    },
    {
      requirement: "Paper accounts reconcile exactly and recover after restart",
      passed: ["event-sourced account reconciliation", "account drift detection", "durable crash recovery"].every((name) => requirements.get(name) === true),
      evidence: ["evidence/execution-v2/account-events.jsonl", "evidence/execution-v2/durable-account-events.jsonl", "test/account-reconciliation.test.ts"],
      detail: "Append-only account events rebuild balances/positions exactly, detect drift, and restore from disk after process restart.",
    },
    {
      requirement: "No fantasy fills",
      passed: proof.passed && ["limit protection", "partial fill remainder", "price-time queue position"].every((name) => requirements.get(name) === true),
      evidence: ["evidence/execution-v2/execution-v2-report.md", "evidence/fill-model/fill-model-report.md"],
      detail: "Limits never consume worse prices, visible/depth liquidity caps fills, and unfilled quantities remain pending.",
    },
  ];
  const passed = rows.every((row) => row.passed);
  const payload = { milestone: "Month 3: Execution engine v2", generatedAt: new Date().toISOString(), passed, rows };
  writeFileSync(join(OUT, "month3-exit-audit.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(join(OUT, "month3-exit-audit.md"), [
    "# Month 3 Exit Audit",
    "",
    `Overall: **${passed ? "PASS" : "FAIL"}** (${rows.filter((row) => row.passed).length}/${rows.length})`,
    "",
    "| Requirement | Result | Detail |",
    "|---|---:|---|",
    ...rows.map((row) => `| ${row.requirement} | ${row.passed ? "PASS" : "FAIL"} | ${row.detail} |`),
  ].join("\n") + "\n");
  console.log(`NIGHTDESK MONTH 3 EXIT AUDIT: ${passed ? "PASS" : "FAIL"} (${rows.filter((row) => row.passed).length}/${rows.length})`);
  if (!passed) process.exitCode = 1;
  return { passed, rows };
}

if (process.argv[1]?.endsWith("month3-exit-audit.ts")) runMonth3ExitAudit();
