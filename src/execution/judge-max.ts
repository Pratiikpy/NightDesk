import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runJudge } from "../judge";
import { runPaperSession } from "./paper-session";
import { runGuardedReplay } from "./guarded-replay";
import { runAgentArenaV2 } from "./arena-v2";
import { runResearchNode } from "./research-node";
import { runOosReport } from "../research/session-study";
import { runSessionBank } from "../research/session-bank";
import { runWalkForwardPnl } from "../research/walkforward-pnl";
import { runFillRealism } from "../research/fill-realism";
import { runIntegrationProof } from "./integration-proof";
import { runBitgetReadOnlyProof } from "../integrations/bitget-agent-hub/readOnlyProof";
import { runOutcomeAudit } from "../evidence/outcome-audit";
import { runPnlCasefile } from "../research/pnl-casefile";
import { runAlphaChampionship } from "../research/alpha-championship";
import { runAlphaFactory } from "../research/alpha-factory";
import { runAlphaCompare, runAlphaZoo } from "../research/alpha-zoo";
import { runShadowGateway } from "../research/shadow-gateway";
import { runClaimLedger } from "../research/claim-ledger";
import { runRunCards } from "../research/run-card";
import { runDoctor } from "../ops/doctor";
import { runDataHealth } from "../ops/data-health";
import { runDocsCheck } from "../ops/docs-check";
import { runSecretsScan } from "../ops/secrets-scan";
import { runJudgeCockpit } from "../face/judge-cockpit";
import { runForwardPaperDaemon } from "./forward-paper-daemon";
import { runDailyPromoter } from "../agent/daily-promoter";
import { runSecurityReport } from "../security/report";
import { runBitgetCompatReport } from "../integrations/bitget-agent-hub/compat-report";
import { runCacheIntegrity } from "../data/cache-integrity";
import { runOosBackground } from "../ops/oos-background";
import { runLiveReceipt } from "./live-receipt";
import { runChampionshipMode } from "../research/championship/championship-mode";

const evidenceFiles = [
  "evidence/trading-log/nightdesk-paper-trading-log.csv",
  "evidence/trading-log/run-events.jsonl",
  "evidence/trading-log/block-reasons.csv",
  "evidence/trading-log/ledger-verification.txt",
  "evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv",
  "evidence/agent-arena-v2/arena-v2-summary.json",
  "evidence/research/walk-forward-report.md",
  "evidence/research/leaderboard.json",
  "evidence/oos/oos-report.md",
  "evidence/oos/session-summary.csv",
  "evidence/oos/session-bank/session-summary.csv",
  "evidence/oos/session-bank/session-quality-report.md",
  "evidence/oos/session-bank/manifest.json",
  "evidence/walkforward/pnl-report.md",
  "evidence/walkforward/fold-results.csv",
  "evidence/walkforward/purged-split-report.md",
  "evidence/walkforward/purged-split-report.csv",
  "evidence/fill-model/fill-model-report.md",
  "evidence/fill-model/partial-fill-cases.csv",
  "evidence/fill-model/adverse-selection-cases.csv",
  "evidence/integration/external-agent-run.jsonl",
  "evidence/integration/malicious-agent-rejections.jsonl",
  "evidence/integration/abuse-report.md",
  "evidence/bitget-live/read-only-proof.md",
  "evidence/bitget-live/live-market-snapshot.json",
  "evidence/outcome-audit/outcome-audit.md",
  "evidence/outcome-audit/outcome-audit.json",
  "evidence/pnl-casefile/00-executive-summary.md",
  "evidence/pnl-casefile/02-guarded-vs-unguarded.csv",
  "evidence/pnl-casefile/03-pnl-attribution.csv",
  "evidence/pnl-casefile/perp-leg-autopsy.md",
  "evidence/pnl-casefile/safety-alpha-report.md",
  "evidence/pnl-casefile/tradeability-bridge.md",
  "evidence/pnl-casefile/manifest.json",
  "evidence/alpha-championship/alpha-championship-report.md",
  "evidence/alpha-championship/aggregate-leaderboard.csv",
  "evidence/alpha-championship/champion-config.json",
  "evidence/alpha-championship/champion-paper-trading-log.csv",
  "evidence/alpha-championship/global-champion-config.json",
  "evidence/alpha-championship/global-champion-paper-trading-log.csv",
  "evidence/alpha-championship/global-champion-session-results.csv",
  "evidence/alpha-championship/leaderboard.csv",
  "evidence/alpha-championship/session-best.csv",
  "evidence/alpha-championship/manifest.json",
  "evidence/alpha-factory/candidate-strategies.csv",
  "evidence/alpha-factory/trial-registry.jsonl",
  "evidence/alpha-factory/rejected-overfit-strategies.csv",
  "evidence/alpha-factory/overfit-court-report.md",
  "evidence/alpha-factory/walkforward-leaderboard.csv",
  "evidence/alpha-factory/frozen-champion.json",
  "evidence/alpha-factory/champion-oos-results.csv",
  "evidence/alpha-factory/live-paper-trading-log.csv",
  "evidence/alpha-factory/expected-vs-actual.csv",
  "evidence/alpha-factory/daily-alpha-report.md",
  "evidence/alpha-factory/mutation-history.jsonl",
  "evidence/alpha-factory/agent-decisions.jsonl",
  "evidence/alpha-factory/masked-eval-report.md",
  "evidence/alpha-factory/agent-benchmark-standard.md",
  "evidence/alpha-factory/bench-results.csv",
  "evidence/alpha-factory/agent-scorecards.md",
  "evidence/alpha-factory/manifest.json",
  "evidence/alpha-factory/alpha-zoo-catalog.csv",
  "evidence/alpha-factory/alpha-zoo-catalog.md",
  "evidence/alpha-factory/strategy-compare.csv",
  "evidence/alpha-factory/strategy-compare.md",
  "evidence/shadow-gateway/actual-vs-guarded.csv",
  "evidence/shadow-gateway/missed-profit.csv",
  "evidence/shadow-gateway/blocked-loss.csv",
  "evidence/shadow-gateway/rule-breaks.md",
  "evidence/shadow-gateway/counterfactual-trades.jsonl",
  "evidence/claims/claims-manifest.json",
  "evidence/claims/claims-report.md",
  "evidence/run-cards/manifest.json",
  "evidence/run-cards/paper-session-card.md",
  "evidence/run-cards/alpha-factory-card.md",
  "evidence/run-cards/alpha-championship-card.md",
  "evidence/run-cards/guarded-replay-card.md",
  "evidence/run-cards/bitget-smoke-card.md",
  "evidence/run-cards/judge-max-card.md",
  "evidence/doctor-report.md",
  "evidence/doctor-report.json",
  "evidence/data-health/source-health.json",
  "evidence/data-health/source-health.md",
  "evidence/docs-check.json",
  "evidence/secrets-scan.json",
  "evidence/judge-cockpit/index.html",
  "evidence/forward-paper-daemon/session-results.csv",
  "evidence/forward-paper-daemon/live-paper-trading-log.csv",
  "evidence/forward-paper-daemon/daemon-state.json",
  "evidence/forward-paper-daemon/forward-paper-daemon-report.md",
  "evidence/daily-promoter/promotion-decision.json",
  "evidence/daily-promoter/daily-promoter-report.md",
  "evidence/security/security-boundaries.md",
  "evidence/security/security-boundaries.json",
  "evidence/bitget-live/agent-hub-compat-report.md",
  "evidence/bitget-live/agent-hub-compat-report.json",
  "evidence/data-cache/cache-integrity-report.md",
  "evidence/data-cache/cache-integrity-report.json",
  "evidence/oos-daemon/state.json",
  "evidence/oos-daemon/record-log.jsonl",
  "evidence/oos-daemon/refresh-log.jsonl",
  "evidence/live-receipt/order-preview.json",
  "evidence/live-receipt/firewall-verdict.json",
  "evidence/live-receipt/execution-receipt.json",
  "evidence/live-receipt/ledger-verify.txt",
  "evidence/live-receipt/live-receipt-report.md",
  "evidence/championship/leaderboard_pnl.csv",
  "evidence/championship/leaderboard_safety.csv",
  "evidence/championship/champion-pnl.json",
  "evidence/championship/champion-safety.json",
  "evidence/championship/champion-pnl-paper-log.csv",
  "evidence/championship/champion-safety-paper-log.csv",
  "evidence/championship/championship-report.md",
  "evidence/championship/pnl-vs-safety-comparison.md",
  "evidence/championship/champion-overfit-check.md",
  "evidence/championship/champion-overfit-card.md",
  "evidence/championship/trial-registry.csv",
  "evidence/championship/manifest.json",
  "evidence/manifest.json",
  "docs/PNL_CLAIM_STANDARD.md",
  "docs/NAUTILUS_LESSONS.md",
  "docs/SECURITY_BOUNDARIES.md",
  "docs/BITGET_NATIVE_PROOF.md",
  "docs/CLAIM_LEDGER.md",
];

function writeMaxManifest(): boolean {
  const manifest = evidenceFiles.map((file) => ({ file, exists: file === "evidence/manifest.json" ? true : existsSync(file), generatedAt: new Date().toISOString() }));
  const body = JSON.stringify({ generatedAt: new Date().toISOString(), manifest }, null, 2) + "\n";
  writeFileSync(join(process.cwd(), "evidence", "max-judge-manifest.json"), body);
  writeFileSync(join(process.cwd(), "evidence", "manifest.json"), body);
  const ok = manifest.every((m) => m.exists);
  console.log("\nNIGHTDESK MAX JUDGE PACK");
  for (const m of manifest) console.log(`${m.exists ? "✓" : "✗"} ${m.file}`);
  console.log(ok ? "NIGHTDESK MAX JUDGE PACK VERIFIED" : "NIGHTDESK MAX JUDGE PACK FAILED");
  return ok;
}

export async function runJudgeMax(): Promise<void> {
  await runJudge();
  await runPaperSession([]);
  runGuardedReplay([]);
  runAgentArenaV2([]);
  runResearchNode([]);
  runOosReport([]);
  runSessionBank();
  runWalkForwardPnl([]);
  runFillRealism();
  runIntegrationProof();
  await runBitgetReadOnlyProof();
  runOutcomeAudit();
  runPnlCasefile();
  runAlphaChampionship([]);
  runAlphaFactory([]);
  runAlphaZoo();
  runAlphaCompare();
  runShadowGateway();
  runClaimLedger();
  runRunCards();
  runDoctor();
  runDataHealth();
  runDocsCheck();
  runSecretsScan();
  runForwardPaperDaemon([]);
  runDailyPromoter();
  runSecurityReport();
  runBitgetCompatReport();
  runCacheIntegrity();
  await runOosBackground(["--once"]);
  runLiveReceipt([]);
  runChampionshipMode([]);
  runJudgeCockpit();
  const ok = writeMaxManifest();
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("judge-max.ts")) {
  if (process.argv.includes("--manifest-only")) {
    const ok = writeMaxManifest();
    if (!ok) process.exitCode = 1;
  } else {
    runJudgeMax().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
}
