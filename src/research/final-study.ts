// Final study + freeze (Month 11): a locked comparative study, a claim ledger where every claim maps to
// an existing evidence artifact (no unsupported claim), critical-workflow evidence coverage, and a freeze
// manifest hashing the thesis/protocol/benchmark/claim-boundaries. Design-partner adoption and real user
// feedback are the operational milestones; the verifiable software gates are built here.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { scoreAgent, referenceSafeAgent, alwaysBlockAgent, alwaysAllowAgent, type BenchScorecard } from "../bench/nightdesk-bench";

export interface ClaimEntry { claim: string; evidence: string; reproduce: string }

export const CLAIM_LEDGER: ClaimEntry[] = [
  { claim: "Bitget-schema paper trading log", evidence: "evidence/trading-log/nightdesk-paper-trading-log.csv", reproduce: "npm run paper-session" },
  { claim: "frozen alpha champion + Overfit Court", evidence: "evidence/alpha-factory/overfit-court-report.md", reproduce: "npm run alpha:factory" },
  { claim: "selection-bias controls (Deflated Sharpe / PBO)", evidence: "evidence/alpha-factory/overfit-stats.json", reproduce: "npm run overfit:stats" },
  { claim: "read-only Bitget proof", evidence: "evidence/bitget-live/read-only-proof.md", reproduce: "npm run bitget:read-only-proof" },
  { claim: "15-gate coverage", evidence: "evidence/gates/gate-coverage.md", reproduce: "npm run gates:coverage" },
  { claim: "hostile-input red-team", evidence: "evidence/redteam/redteam-report.md", reproduce: "npm run redteam" },
];

export function unsupportedClaims(ledger: ClaimEntry[] = CLAIM_LEDGER, root = process.cwd()): ClaimEntry[] {
  return ledger.filter((c) => !existsSync(join(root, c.evidence)));
}

export const CRITICAL_WORKFLOWS: { name: string; evidence: string }[] = [
  { name: "paper trading", evidence: "evidence/trading-log" },
  { name: "alpha factory", evidence: "evidence/alpha-factory/manifest.json" },
  { name: "firewall / gates", evidence: "evidence/gates/gate-coverage.md" },
  { name: "forward record", evidence: "evidence/forward-paper-daemon" },
  { name: "red team", evidence: "evidence/redteam/redteam-report.md" },
];

export function workflowsMissingEvidence(root = process.cwd()): string[] {
  return CRITICAL_WORKFLOWS.filter((w) => !existsSync(join(root, w.evidence))).map((w) => w.name);
}

export interface ComparativeStudy { agents: BenchScorecard[]; hash: string }

/** Locked comparative study under equal conditions — deterministic, so it re-hashes identically. */
export function comparativeStudy(): ComparativeStudy {
  const agents = [
    scoreAgent("reference-safe", referenceSafeAgent),
    scoreAgent("always-block", alwaysBlockAgent),
    scoreAgent("always-allow", alwaysAllowAgent),
  ];
  return { agents, hash: createHash("sha256").update(JSON.stringify(agents)).digest("hex") };
}

export const CLAIM_BOUNDARIES = [
  "forward out-of-sample record is early; it grows in wall-clock market time",
  "live receipt is read-only / dry-run; no real fill is claimed",
  "PnL champion is current-recording evidence, not validated future alpha",
  "Deflated Sharpe is not yet significant after correcting for trials",
  "no third-party production users yet",
];

export function freezeManifest(): { protocol: string; claimBoundaries: number; studyHash: string; hash: string } {
  const study = comparativeStudy();
  const body = { protocol: "nightdesk.v1", claimBoundaries: CLAIM_BOUNDARIES, studyHash: study.hash };
  return { protocol: body.protocol, claimBoundaries: CLAIM_BOUNDARIES.length, studyHash: study.hash, hash: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
}
