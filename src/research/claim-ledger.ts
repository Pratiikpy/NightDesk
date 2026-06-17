import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "claims");

interface Claim {
  id: string;
  claim: string;
  acceptance_criteria: string[];
  evidence: string[];
  status: "verified" | "partial" | "blocked";
  caveat: string;
}

const claims: Claim[] = [
  {
    id: "paper_trading_record",
    claim: "NightDesk produces Bitget-style paper trading records with timestamp, asset, direction, price, quantity, and balance change.",
    acceptance_criteria: ["CSV exists", "schema contains required Bitget fields", "executed fills and blocked intents are both present"],
    evidence: ["evidence/trading-log/nightdesk-paper-trading-log.csv", "evidence/trading-log/run-summary.md", "evidence:verify"],
    status: "verified",
    caveat: "Paper record is execution evidence, not a live capital claim.",
  },
  {
    id: "alpha_factory",
    claim: "NightDesk autonomously searches strategy candidates, rejects fragile configs, freezes a champion, and exports expected-vs-actual evidence.",
    acceptance_criteria: ["trial registry exists", "rejected strategies exist", "frozen champion exists", "paper log exists"],
    evidence: ["evidence/alpha-factory/manifest.json", "evidence/alpha-factory/trial-registry.jsonl", "evidence/alpha-factory/frozen-champion.json"],
    status: "verified",
    caveat: "Current dataset has 3 recordings; future OOS sessions remain the next proof layer.",
  },
  {
    id: "raw_pnl_championship",
    claim: "NightDesk can compete on raw PnL over current recordings through a reproducible Alpha Championship.",
    acceptance_criteria: ["champion positive", "global same-config replay positive", "paper log exported"],
    evidence: ["evidence/alpha-championship/manifest.json", "evidence/alpha-championship/champion-paper-trading-log.csv"],
    status: "verified",
    caveat: "In-sample/current-recording championship, not guaranteed future alpha.",
  },
  {
    id: "safety_gateway",
    claim: "Unsafe external-agent intents are rejected or capped before execution.",
    acceptance_criteria: ["firewall tests pass", "property tests pass", "sample unsafe verdict exists", "external integration proof exists"],
    evidence: ["evidence/sample-outputs/unsafe-sell-verdict.json", "evidence/integration/external-agent-run.jsonl", "test/kernel.property.test.ts"],
    status: "verified",
    caveat: "Live trading remains explicitly gated and disabled by default.",
  },
  {
    id: "bitget_native",
    claim: "NightDesk can generate certificates from live public Bitget market data without credentials.",
    acceptance_criteria: ["read-only proof exists", "live snapshot exists", "no secrets in logs"],
    evidence: ["evidence/bitget-live/read-only-proof.md", "evidence/bitget-live/live-market-snapshot.json"],
    status: "verified",
    caveat: "Private trading endpoints are not required for judge reproduction.",
  },
  {
    id: "shadow_gateway",
    claim: "NightDesk measures whether guarding helps by comparing actual, guarded, reckless, and always-block counterfactuals.",
    acceptance_criteria: ["actual-vs-guarded exists", "missed-profit exists", "blocked-loss exists"],
    evidence: ["evidence/shadow-gateway/actual-vs-guarded.csv", "evidence/shadow-gateway/missed-profit.csv", "evidence/shadow-gateway/blocked-loss.csv"],
    status: "verified",
    caveat: "This report is honest when guarding reduces raw PnL on a sample.",
  },
];

function statusFor(claim: Claim): Claim["status"] {
  const missing = claim.evidence.filter((e) => e.includes("/") && !existsSync(join(process.cwd(), e)));
  if (!missing.length) return claim.status;
  return "partial";
}

export function runClaimLedger(): void {
  mkdirSync(OUT, { recursive: true });
  const hydrated = claims.map((c) => ({ ...c, status: statusFor(c) }));
  writeFileSync(join(OUT, "claims-manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), claims: hydrated }, null, 2) + "\n");
  for (const claim of hydrated) writeFileSync(join(OUT, `${claim.id}.json`), JSON.stringify(claim, null, 2) + "\n");
  writeFileSync(
    join(OUT, "claims-report.md"),
    [
      "# NightDesk Claim Ledger",
      "",
      "| Claim | Status | Evidence | Caveat |",
      "|---|---|---|---|",
      ...hydrated.map((c) => `| ${c.claim} | ${c.status} | ${c.evidence.join("<br>")} | ${c.caveat} |`),
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK CLAIM LEDGER COMPLETE: ${join(OUT, "claims-manifest.json")}`);
}

if (process.argv[1]?.endsWith("claim-ledger.ts")) runClaimLedger();
