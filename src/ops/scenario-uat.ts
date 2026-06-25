import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type Status = "PASS" | "FAIL" | "KNOWN-LIMITATION";

interface ScenarioCommand {
  command: string;
  env?: Record<string, string>;
  optional?: boolean;
}

interface Scenario {
  id: string;
  name: string;
  persona: string;
  goal: string;
  commands: ScenarioCommand[];
  artifacts: string[];
  passCriteria: string[];
  failIf: string[];
}

interface ScenarioResult extends Scenario {
  status: Status;
  durationMs: number;
  commandResults: { command: string; status: Status; durationMs: number; tail: string }[];
  artifactResults: { file: string; exists: boolean; nonEmpty: boolean }[];
  notes: string[];
}

const scenarios: Scenario[] = [
  {
    id: "fresh-repo",
    name: "Judge opens repo fresh",
    persona: "Hackathon judge",
    goal: "Prove install, build, tests, and judge pack run without manual help.",
    commands: [{ command: "npm ci --dry-run" }, { command: "npm run build" }, { command: "npm test" }, { command: "npm run judge:max" }],
    artifacts: ["evidence/manifest.json", "evidence/judge-run.json", "evidence/run-cards/judge-max-card.md", "evidence/judge-cockpit/index.html"],
    passCriteria: ["Lockfile install dry-run passes", "Typecheck passes", "177 tests pass", "judge:max passes"],
    failIf: ["Needs hidden local files", "Needs API keys for core demo", "Manifest missing"],
  },
  {
    id: "paper-record",
    name: "Judge wants paper trading record",
    persona: "Trading-track judge",
    goal: "Prove NightDesk produces Bitget-style paper trading logs.",
    commands: [{ command: "npm run paper-session" }, { command: "npm run paper-log:verify" }],
    artifacts: ["evidence/trading-log/nightdesk-paper-trading-log.csv", "evidence/trading-log/run-summary.md", "evidence/trading-log/account-snapshots.jsonl", "evidence/paper-log-verify.json"],
    passCriteria: ["Timestamp/asset/direction/price/quantity/balance fields present", "Trade and block rows validated", "Balance math verified"],
    failIf: ["ALLOW without certificate", "REJECT without reason", "Balance mismatch"],
  },
  {
    id: "external-agent",
    name: "External agent uses NightDesk",
    persona: "Infra judge / third-party developer",
    goal: "Prove SDK/MCP integration path is runnable.",
    commands: [{ command: "npm run sdk:example" }, { command: "npm run external-agent-demo" }, { command: "npm run mcp:integration-test" }],
    artifacts: ["evidence/integration/external-agent-run.jsonl", "evidence/integration/sdk-example-output.json", "evidence/integration/mcp-tool-call-log.jsonl"],
    passCriteria: ["External intent evaluated", "MCP-shaped calls logged", "Paper execution happens only after approval"],
    failIf: ["External agent bypasses firewall", "MCP emits invalid JSON", "SDK requires undocumented config"],
  },
  {
    id: "malicious-agent",
    name: "Malicious agent attacks gateway",
    persona: "Adversarial agent",
    goal: "Prove unsafe intents reject and valid oversized intents cap.",
    commands: [{ command: "npm run malicious-agent:test" }, { command: "npm run redteam" }, { command: "npm run test:properties" }],
    artifacts: ["evidence/integration/malicious-agent-rejections.jsonl", "evidence/redteam/redteam-report.md"],
    passCriteria: ["unsafe_intents_allowed = 0", "Tampered/expired/stale certs rejected", "Malformed intents rejected"],
    failIf: ["Unsafe ALLOW", "Crash instead of rejection", "Rejection lacks reason"],
  },
  {
    id: "quant-overfit",
    name: "Quant judge checks overfitting",
    persona: "Skeptical quant judge",
    goal: "Prove green PnL is accompanied by trial registry and overfit controls.",
    commands: [{ command: "npm run championship:report" }, { command: "npm run championship:overfit-check" }, { command: "npm run alpha:factory" }, { command: "npm run alpha:compare" }],
    artifacts: ["evidence/championship/leaderboard_pnl.csv", "evidence/championship/leaderboard_safety.csv", "evidence/championship/champion-overfit-card.md", "evidence/alpha-factory/trial-registry.jsonl", "evidence/alpha-factory/rejected-overfit-strategies.csv"],
    passCriteria: ["Trial registry present", "Rejected configs present", "PnL and Safety champions separate", "Fragility label present"],
    failIf: ["Same-sample PnL claimed as guaranteed future alpha", "Winner lacks cutoff", "Rejected configs lack reasons"],
  },
  {
    id: "pnl-only",
    name: "Judge cares only about PnL",
    persona: "PnL-first judge",
    goal: "Show PnL Champion and Safety Champion with claim boundaries.",
    commands: [{ command: "npm run championship:replay" }, { command: "npm run pnl:casefile" }],
    artifacts: ["evidence/pnl-casefile/00-executive-summary.md", "evidence/pnl-casefile/03-pnl-attribution.csv", "evidence/championship/champion-pnl-paper-log.csv", "evidence/championship/champion-safety-paper-log.csv"],
    passCriteria: ["PnL Champion replay exists", "Safety Champion replay exists", "Claim boundary visible"],
    failIf: ["No drawdown/baseline", "Paper log lacks balance changes", "PnL champion bypasses hard gates"],
  },
  {
    id: "safety-ledger",
    name: "Safety judge checks certificates and ledger",
    persona: "Safety-focused judge",
    goal: "Prove certificates/firewall/ledger/tamper evidence work.",
    commands: [{ command: "npm run certify" }, { command: "npm run firewall" }, { command: "npm run verify" }, { command: "npm run ledger:tamper-test" }],
    artifacts: ["evidence/trading-log/ledger-verification.txt", "evidence/ledger-tamper-test.json"],
    passCriteria: ["Certificate path runs", "Firewall path runs", "Ledger verifies", "Tamper test fails mutated records"],
    failIf: ["Tampered ledger passes", "Certificate has no expiry", "Wrong ticker cert works"],
  },
  {
    id: "fill-realism",
    name: "Execution realism judge checks fills",
    persona: "Execution realism judge",
    goal: "Prove paper PnL is not fantasy mid-price fills.",
    commands: [{ command: "npm run fill:realism-report" }, { command: "npm run fill:stress" }, { command: "npm run fill:slippage-sweep" }],
    artifacts: ["evidence/fill-model/fill-model-report.md", "evidence/fill-model/adverse-selection-cases.csv", "evidence/fill-model/slippage-sweep.csv", "evidence/fill-model/partial-fill-cases.csv"],
    passCriteria: ["Partial/stale/adverse/bad-book cases pass", "Fees/slippage included"],
    failIf: ["Mid fills without depth", "Fees ignored", "Bad book fills"],
  },
  {
    id: "bitget-native",
    name: "Bitget-native proof",
    persona: "Bitget ecosystem judge",
    goal: "Prove public Bitget read-only data and Agent Hub-compatible posture.",
    commands: [{ command: "npm run bitget:read-only-proof" }, { command: "npm run bitget:smoke" }, { command: "npm run bitget:agent-hub-demo" }],
    artifacts: ["evidence/bitget-live/read-only-proof.md", "evidence/bitget-live/live-market-snapshot.json", "evidence/bitget-live/certificate-from-live-data.json", "evidence/bitget-live/agent-hub-compat-report.md"],
    passCriteria: ["Read-only proof generated", "No trade credentials required", "Agent Hub compatibility report exists"],
    failIf: ["Secrets logged", "Write action possible in read-only mode", "Certificate lacks source timestamp"],
  },
  {
    id: "ops-reliability",
    name: "Ops judge checks reliability",
    persona: "Ops/reliability judge",
    goal: "Prove the repo diagnoses itself.",
    commands: [{ command: "npm run doctor" }, { command: "npm run data:health" }, { command: "npm run cache:verify" }],
    artifacts: ["evidence/doctor-report.md", "evidence/data-health/source-health.json", "evidence/data-cache/cache-integrity-report.md"],
    passCriteria: ["Doctor report generated", "Data health matrix generated", "Cache/staleness report generated"],
    failIf: ["Provider outage crashes core judge run", "Doctor prints secrets"],
  },
  {
    id: "security",
    name: "Secrets and security review",
    persona: "Security judge",
    goal: "Prove no real credentials are leaked and live paths fail closed.",
    commands: [{ command: "npm run secrets:scan" }, { command: "npm run security:test" }],
    artifacts: ["evidence/secrets-scan.json", "evidence/security/security-boundaries.md"],
    passCriteria: ["No real credential findings", "Runtime ledger key explicitly labeled", "Live defaults fail closed"],
    failIf: ["BITGET/QWEN key found", ".env committed", "Private key printed in logs"],
  },
  {
    id: "docs",
    name: "Documentation consistency",
    persona: "Confused human / judge",
    goal: "Prove docs do not contradict code.",
    commands: [{ command: "npm run docs:check" }],
    artifacts: ["evidence/docs-check.json"],
    passCriteria: ["Docs exist", "No stale test/gate counts", "No alpha/live overclaims"],
    failIf: ["Old test counts", "Guaranteed alpha", "Live fill claimed for dry-run"],
  },
  {
    id: "cockpit",
    name: "Judge opens cockpit",
    persona: "Demo judge",
    goal: "Prove the project is understandable in 30 seconds.",
    commands: [{ command: "npm run dashboard:judge" }],
    artifacts: ["evidence/judge-cockpit/index.html"],
    passCriteria: ["Static cockpit generated", "Contains thesis/evidence/reproduction surface"],
    failIf: ["Starts with repo tree", "No paper/PnL/Bitget proof"],
  },
  {
    id: "offline",
    name: "Offline/degraded mode",
    persona: "Judge running during provider trouble",
    goal: "Prove core judge path does not require live providers.",
    commands: [
      { command: "npm run judge:max", env: { BITGET_OFFLINE: "1" } },
      { command: "npm run judge:max", env: { QWEN_OFFLINE: "1" } },
      { command: "npm run judge:max", env: { YAHOO_OFFLINE: "1" } },
    ],
    artifacts: ["evidence/max-judge-manifest.json", "evidence/manifest.json"],
    passCriteria: ["Core evidence verifies with offline env toggles", "No unsafe trade allowed"],
    failIf: ["Provider outage crashes core path", "Missing anchor becomes tradeable"],
  },
  {
    id: "oos-daemon",
    name: "OOS daemon is running and useful",
    persona: "Forward-evidence judge",
    goal: "Prove future evidence is accumulating or last state is visible.",
    commands: [{ command: "npm run oos:status" }, { command: "npm run oos:report" }],
    artifacts: ["evidence/oos/session-summary.csv", "evidence/oos/oos-report.md", "evidence/oos/session-bank/session-quality-report.md"],
    passCriteria: ["Daemon state visible", "OOS report generated", "Session bank has ledger hashes"],
    failIf: ["Daemon status stale with no snapshots", "OOS report counts empty sessions as success"],
  },
];

function run(command: ScenarioCommand): { status: Status; output: string; durationMs: number } {
  const started = Date.now();
  const res = spawnSync(command.command, {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
    env: { ...process.env, ...command.env, FORCE_COLOR: "0" },
    maxBuffer: 30 * 1024 * 1024,
    timeout: 300_000, // hard per-command cap: a hung sub-process can never stall the whole UAT
  });
  const timedOut = (res.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  const status: Status = res.status === 0 ? "PASS" : command.optional ? "KNOWN-LIMITATION" : "FAIL";
  const extra = timedOut ? "\n[scenario-uat] command exceeded the 300s cap and was terminated" : "";
  return { status, output: `${res.stdout ?? ""}${res.stderr ?? ""}${extra}`.trim(), durationMs: Date.now() - started };
}

function artifact(file: string): { file: string; exists: boolean; nonEmpty: boolean } {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) return { file, exists: false, nonEmpty: false };
  const nonEmpty = readFileSync(path).length > 0;
  return { file, exists: true, nonEmpty };
}

function mdTable(results: ScenarioResult[]): string {
  return [
    "| Scenario | Persona | Status | Commands | Artifacts | Notes |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...results.map((r) => `| ${r.name} | ${r.persona} | ${r.status} | ${r.commandResults.length} | ${r.artifactResults.filter((a) => a.exists && a.nonEmpty).length}/${r.artifacts.length} | ${r.notes.join("; ").replace(/\|/g, "/")} |`),
    "",
  ].join("\n");
}

export function runScenarioUat(): void {
  const results: ScenarioResult[] = scenarios.map((scenario) => {
    const commandResults = scenario.commands.map(run);
    const artifactResults = scenario.artifacts.map(artifact);
    const notes: string[] = [];
    const badCommands = commandResults.map((c, i) => ({ ...c, command: scenario.commands[i]!.command })).filter((c) => c.status === "FAIL");
    const badArtifacts = artifactResults.filter((a) => !a.exists || !a.nonEmpty);
    if (badCommands.length) notes.push(`failed commands: ${badCommands.map((c) => c.command).join(", ")}`);
    if (badArtifacts.length) notes.push(`missing/empty artifacts: ${badArtifacts.map((a) => a.file).join(", ")}`);
    const status: Status = badCommands.length || badArtifacts.length ? "FAIL" : "PASS";
    if (!notes.length) notes.push("scenario passed");
    return { ...scenario, status, durationMs: commandResults.reduce((sum, c) => sum + c.durationMs, 0), commandResults: commandResults.map((c, i) => ({ command: scenario.commands[i]!.command, status: c.status, durationMs: c.durationMs, tail: c.output.split(/\r?\n/).slice(-20).join("\n") })), artifactResults, notes };
  });
  const ok = results.every((r) => r.status === "PASS");
  const out = join(process.cwd(), "evidence", "scenario-uat");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "scenario-uat.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ok, results }, null, 2) + "\n");
  writeFileSync(join(out, "scenario-uat-report.md"), [
    "# NightDesk Scenario UAT Report",
    "",
    `Status: ${ok ? "PASS" : "FAIL"}`,
    `Scenarios: ${results.length}`,
    "",
    mdTable(results),
    "## Known Boundaries",
    "",
    "- Fresh public clone proof still requires running against the public GitHub URL or CI environment.",
    "- OOS evidence continues to grow over future market sessions.",
    "- Live trade receipt remains dry-run unless an explicit dust execution is performed.",
    "- Championship PnL is current-recording paper evidence, not a guaranteed future alpha claim.",
    "",
  ].join("\n"));
  console.log(`NIGHTDESK SCENARIO UAT ${ok ? "PASS" : "FAIL"}`);
  console.log(`scenarios=${results.length} failures=${results.filter((r) => r.status === "FAIL").length}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("scenario-uat.ts")) runScenarioUat();
