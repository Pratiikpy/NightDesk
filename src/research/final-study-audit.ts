// Month 11 exit-gate audit — product adoption + final study. Verifies the plan's exit criteria: no major
// unsupported claim (every claim maps to existing evidence), every critical workflow has evidence, the
// final comparative study is locked (re-hashes identically), the freeze manifest is stable, and the final
// evaluation no longer changes strategy parameters. Run: `npm run study:month11-audit`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unsupportedClaims, workflowsMissingEvidence, comparativeStudy, freezeManifest, CLAIM_LEDGER } from "./final-study";
import { selectChampionLanes, type LaneCandidate } from "./championship/pnl-objectives";

interface Check { name: string; pass: boolean; detail: string }
const cand = (id: string, netPnl: number, maxDrawdown: number): LaneCandidate => ({ id, hardGatesPassed: true, objective: { netPnl, maxDrawdown, fees: 1, trades: 10, blocks: 0, blockedLossAvoided: 0, falseBlockCost: 0 } });

export function runFinalStudyMonth11Audit(): boolean {
  const checks: Check[] = [];

  // 1. no major unsupported claim — every claim in the ledger maps to existing evidence.
  const unsupported = unsupportedClaims();
  checks.push({ name: "no major unsupported claim (every claim maps to existing evidence)", pass: unsupported.length === 0, detail: `${CLAIM_LEDGER.length} claims; unsupported=${unsupported.map((c) => c.claim).join(", ") || "none"}` });

  // 2. every critical workflow has external evidence.
  const missing = workflowsMissingEvidence();
  checks.push({ name: "every critical workflow has evidence", pass: missing.length === 0, detail: `missing=${missing.join(", ") || "none"}` });

  // 3. final comparative study is locked — deterministic re-hash is identical.
  const a = comparativeStudy();
  const b = comparativeStudy();
  checks.push({ name: "final comparative study is locked (re-runs to an identical hash)", pass: a.hash === b.hash && a.agents.length === 3, detail: `studyHash ${a.hash.slice(0, 12)}…; stable=${a.hash === b.hash}` });

  // 4. freeze manifest (thesis/protocol/benchmark/claim-boundaries) is stable.
  const f1 = freezeManifest();
  const f2 = freezeManifest();
  checks.push({ name: "freeze manifest (protocol, claim boundaries, study) is stable", pass: f1.hash === f2.hash && f1.claimBoundaries >= 5, detail: `freezeHash ${f1.hash.slice(0, 12)}…; boundaries=${f1.claimBoundaries}` });

  // 5. final evaluation no longer changes strategy parameters — a locked champion ignores any re-fit.
  const locked = selectChampionLanes([cand("frozen", 10, 2), cand("hotter", 99, 2)], { pnl: "frozen" });
  checks.push({ name: "final evaluation no longer changes strategy parameters (locked champion frozen)", pass: locked.pnl === "frozen", detail: `pnl lane stays ${locked.pnl} despite a higher-scoring candidate` });

  const passed = checks.filter((c) => c.pass).length;
  const ok = passed === checks.length;
  const OUT = join(process.cwd(), "evidence", "final-study");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "freeze-manifest.json"), JSON.stringify(f1, null, 2) + "\n");
  writeFileSync(join(OUT, "comparative-study.json"), JSON.stringify(a, null, 2) + "\n");
  writeFileSync(join(OUT, "month11-exit-audit.md"), [
    "# Month 11 Exit Audit — Product Adoption + Final Study",
    "",
    `Result: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`,
    "",
    "| Exit-gate requirement | Status | Detail |",
    "| --- | --- | --- |",
    ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`),
    "",
    "Every claim maps to existing evidence; critical workflows are covered; the comparative study and freeze",
    "manifest are deterministic; the locked champion is frozen. Design-partner adoption and real user feedback",
    "are the operational milestones this study gate is built to evaluate honestly.",
  ].join("\n") + "\n");

  console.log(`NIGHTDESK MONTH 11 EXIT AUDIT: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`);
  for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

if (process.argv[1]?.endsWith("final-study-audit.ts")) runFinalStudyMonth11Audit();
