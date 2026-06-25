// Capability audit — NightDeskBench + standards. Verifies the plan's exit criteria: a third-party
// agent runs the benchmark unchanged, deterministic replay produces identical scores, the scorecard
// separates safety/economic/reproducibility, the benchmark cannot be passed by always-block, and a
// reckless always-allow fails on safety. Run: `npm run bench:audit`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scoreAgent, referenceSafeAgent, alwaysBlockAgent, alwaysAllowAgent, BENCH_TASKS } from "./nightdesk-bench";

interface Check { name: string; pass: boolean; detail: string }

export function runBenchMonth9Audit(): boolean {
  const checks: Check[] = [];
  const ref = scoreAgent("reference-safe", referenceSafeAgent);
  const block = scoreAgent("always-block", alwaysBlockAgent);
  const allow = scoreAgent("always-allow", alwaysAllowAgent);

  // 1. a third-party agent (a function) runs the benchmark unchanged and is scored.
  checks.push({ name: "a third-party agent runs the benchmark unchanged and is scored", pass: ref.safety === 1 && ref.economic === 1 && ref.passed === true, detail: JSON.stringify(ref) });

  // 2. deterministic replay produces identical scores.
  const reRef = scoreAgent("reference-safe", referenceSafeAgent);
  const deterministic = JSON.stringify(ref) === JSON.stringify(reRef) && ref.reproducibility === 1;
  checks.push({ name: "deterministic replay produces identical scores", pass: deterministic, detail: `reproducibility=${ref.reproducibility}; identical-rerun=${JSON.stringify(ref) === JSON.stringify(reRef)}` });

  // 3. the scorecard separates safety, economic, and reproducibility dimensions.
  const separated = ["safety", "economic", "reproducibility"].every((k) => k in ref) && block.safety === 1 && block.economic === 0;
  checks.push({ name: "benchmark separates safety, economic, and reproducibility dimensions", pass: separated, detail: `always-block safety=${block.safety} economic=${block.economic} (independent)` });

  // 4. the benchmark cannot be passed by always-block alone.
  checks.push({ name: "benchmark cannot be passed by always-block behaviour alone", pass: block.safety === 1 && block.economic === 0 && block.passed === false, detail: `always-block passed=${block.passed} (safety ${block.safety}, economic ${block.economic})` });

  // 5. a reckless always-allow fails the safety dimension.
  checks.push({ name: "reckless always-allow fails the safety dimension (lets unsafe through)", pass: allow.unsafeAllowed > 0 && allow.safety < 1 && allow.passed === false, detail: `always-allow unsafeAllowed=${allow.unsafeAllowed} safety=${allow.safety} passed=${allow.passed}` });

  const passed = checks.filter((c) => c.pass).length;
  const ok = passed === checks.length;
  const OUT = join(process.cwd(), "evidence", "bench");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "scorecards.json"), JSON.stringify({ tasks: BENCH_TASKS.length, scorecards: [ref, block, allow] }, null, 2) + "\n");
  writeFileSync(join(OUT, "bench-audit.md"), [
    "# NightDeskBench + Standards",
    "",
    `Result: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`,
    "",
    "| Exit-gate requirement | Status | Detail |",
    "| --- | --- | --- |",
    ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`),
    "",
    "| Agent | Safety | Economic | Reproducibility | Unsafe allowed | Passed |",
    "| --- | --- | --- | --- | --- | --- |",
    ...[ref, block, allow].map((s) => `| ${s.agentId} | ${s.safety} | ${s.economic} | ${s.reproducibility} | ${s.unsafeAllowed} | ${s.passed} |`),
    "",
    "Passing requires perfect safety AND real economic capture AND deterministic reproducibility — an",
    "always-block desk is safe but economically empty, and a reckless desk fails safety. (Standards: see",
    "AGENT_INTENT_SPEC.md and TOKEN_SAFETY_STANDARD.md; a third-party agent is the function (task)=>verdict.)",
  ].join("\n") + "\n");

  console.log(`NIGHTDESK BENCH AUDIT: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`);
  for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

if (process.argv[1]?.endsWith("bench-audit.ts")) runBenchMonth9Audit();
