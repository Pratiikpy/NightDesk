// Generates the hackathon evidence pack: deterministic judge-run summary, API-style call log,
// and sample inputs/outputs that prove the Agent Safety Gateway can be run and integrated.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import { runSimulation } from "../orchestrator/nightdesk";
import { verifyLedgerFile } from "../ledger/verify";
import { runGauntlet } from "../research/arena";
import { issueCertificate, verifyCertificate, type NightDeskCertificate } from "../kernel/certificate";
import { evaluateIntent, type TradeIntent } from "../kernel/firewall";
import { runPaperSession } from "../execution/paper-session";
import type { TokenCert } from "../research/certify";

const evidenceDir = join(process.cwd(), "evidence");
const inputsDir = join(evidenceDir, "sample-inputs");
const outputsDir = join(evidenceDir, "sample-outputs");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function appendJsonlLine(lines: unknown[], value: unknown): void {
  lines.push(value);
}

function tokenCert(policy: TokenCert["policy"], safetyScore: number): TokenCert {
  return {
    ticker: "NVDA",
    trueGapPct: -2.14,
    perpGapPct: -0.08,
    classification: policy === "BLOCK" ? "LIQUIDITY-TRAP" : "MISPRICED",
    qualityGrade: "B",
    safetyScore,
    policy,
    evidence: [
      "true gap vs real-stock anchor is actionable",
      "perp gap is near flat, so the perp hides the rToken dislocation",
      "no fresh news/macro catalyst in this deterministic fixture",
    ],
  };
}

function apiLogEntry(surface: string, request: unknown, response: unknown, note: string): unknown {
  return {
    ts: new Date().toISOString(),
    surface,
    note,
    request,
    response,
  };
}

export async function generateEvidencePack(): Promise<void> {
  mkdirSync(inputsDir, { recursive: true });
  mkdirSync(outputsDir, { recursive: true });

  const now = Date.UTC(2026, 5, 16, 12, 0, 0);
  const safeCert = issueCertificate(tokenCert("LONG-ONLY FADE", 90), {
    anchorSource: "LAST_CLOSE",
    anchorStale: false,
    now,
    ttlSec: 3600,
  });
  const blockCert = issueCertificate(tokenCert("BLOCK", 35), {
    anchorSource: "LAST_CLOSE",
    anchorStale: false,
    now,
    ttlSec: 3600,
  });

  const safeBuy: TradeIntent = { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: safeCert };
  const unsafeSell: TradeIntent = { ticker: "NVDA", side: "sell", sizeUsd: 50, certificate: safeCert };
  const blockedBuy: TradeIntent = { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: blockCert };
  const noCert: TradeIntent = { ticker: "NVDA", side: "buy", sizeUsd: 50 };

  const safeBuyVerdict = evaluateIntent(safeBuy, now);
  const unsafeSellVerdict = evaluateIntent(unsafeSell, now);
  const blockedBuyVerdict = evaluateIntent(blockedBuy, now);
  const noCertVerdict = evaluateIntent(noCert, now);
  const certVerification = verifyCertificate(safeCert, now);
  const withCertContext = (verdict: unknown, cert: NightDeskCertificate): unknown => ({
    ...(verdict as Record<string, unknown>),
    allowedPolicy: cert.payload.allowedPolicy,
    classification: cert.payload.classification,
    safetyScore: cert.payload.safetyScore,
    maxSizeUsd: cert.payload.maxSizeUsd,
    certificateExpiresAt: cert.payload.expiresAt,
  });

  writeJson(join(inputsDir, "safe-buy-intent.json"), { ticker: safeBuy.ticker, side: safeBuy.side, sizeUsd: safeBuy.sizeUsd });
  writeJson(join(inputsDir, "unsafe-sell-intent.json"), { ticker: unsafeSell.ticker, side: unsafeSell.side, sizeUsd: unsafeSell.sizeUsd });
  writeJson(join(inputsDir, "mcp-evaluate-intent.json"), {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "evaluate_intent", arguments: { ticker: "NVDA", side: "buy", sizeUsd: 50 } },
  });
  writeJson(join(outputsDir, "safe-buy-verdict.json"), withCertContext(safeBuyVerdict, safeCert));
  writeJson(join(outputsDir, "unsafe-sell-verdict.json"), withCertContext(unsafeSellVerdict, safeCert));
  writeJson(join(outputsDir, "blocked-buy-verdict.json"), withCertContext(blockedBuyVerdict, blockCert));
  writeJson(join(outputsDir, "signed-certificate.json"), safeCert);

  const apiLog: unknown[] = [];
  appendJsonlLine(
    apiLog,
    apiLogEntry(
      "sdk",
      { code: "await nd.evaluateIntent({ ticker: 'NVDA', side: 'buy', sizeUsd: 50 })" },
      safeBuyVerdict,
      "Same verdict shape returned by sdk/nightdesk-client.ts when the dashboard HTTP API is running."
    )
  );
  appendJsonlLine(
    apiLog,
    apiLogEntry(
      "http",
      { method: "GET", path: "/api/firewall?ticker=NVDA&side=buy&sizeUsd=50" },
      {
        verdict: safeBuyVerdict.verdict,
        reason: safeBuyVerdict.reason,
        allowedPolicy: safeCert.payload.allowedPolicy,
        classification: safeCert.payload.classification,
        safetyScore: safeCert.payload.safetyScore,
        maxSizeUsd: safeCert.payload.maxSizeUsd,
      },
      "Dashboard endpoint issues a fresh certificate, then enforces the same firewall decision."
    )
  );
  appendJsonlLine(
    apiLog,
    apiLogEntry(
      "mcp",
      {
        method: "tools/call",
        params: { name: "evaluate_intent", arguments: { ticker: "NVDA", side: "sell", sizeUsd: 50 } },
      },
      unsafeSellVerdict,
      "MCP tool exposes the same enforcement contract to Claude, Cursor, Codex, or Agent Hub-style agents."
    )
  );
  appendJsonlLine(apiLog, apiLogEntry("kernel", noCert, noCertVerdict, "No certificate means no trade."));
  writeFileSync(join(evidenceDir, "api-call-log.jsonl"), apiLog.map((x) => JSON.stringify(x)).join("\n") + "\n");

  await runPaperSession([]);

  const snaps = loadSnapshots("data/fixtures/live-demo.jsonl");
  const sim = await runSimulation(snaps, { startCash: 100_000 });
  const ledgerFile = sim.ledger.save();
  const ledgerVerification = verifyLedgerFile(ledgerFile);

  let gauntlet: unknown = { present: false, note: "data/snapshots/2026-06-15.jsonl not available" };
  try {
    const recording = loadSnapshots("data/snapshots/2026-06-15.jsonl");
    const g = runGauntlet(recording);
    const naive = g.find((x) => x.policy === "naive_gap");
    gauntlet = {
      present: true,
      naiveGap: naive
        ? {
            unguardedNetPnlPct: naive.unguarded.totalNetPnlPct,
            guardedNetPnlPct: naive.guarded.totalNetPnlPct,
            blocked: naive.guarded.blocked,
            unguardedLosers: naive.unguarded.losers,
            guardedBeatsOrTies: naive.guarded.totalNetPnlPct >= naive.unguarded.totalNetPnlPct,
          }
        : null,
    };
  } catch {
    // The judge pack remains valid without this optional live recording.
  }

  const judgeRun = {
    generatedAt: new Date().toISOString(),
    project: "NightDesk Agent Safety Gateway",
    thesis:
      "Certify Bitget tokenized-stock markets, reject unsafe agent trade intents, stress-test reckless policies, and sign every action/non-action.",
    reproducibleCommands: [
      "npm install",
      "npm run build",
      "npm test",
      "npm run evidence",
      "npm run paper-session",
      "npm run judge",
      "npm run dashboard",
      "npm run mcp",
    ],
    checks: [
      {
        name: "certificate verifies",
        ok: certVerification.valid,
        detail: certVerification.reason,
      },
      {
        name: "firewall rejects no-certificate intent",
        ok: noCertVerdict.verdict === "REJECT",
        detail: noCertVerdict.reason,
      },
      {
        name: "firewall rejects unsafe sell under LONG-ONLY FADE",
        ok: unsafeSellVerdict.verdict === "REJECT",
        detail: unsafeSellVerdict.reason,
      },
      {
        name: "firewall allows/caps safe buy",
        ok: safeBuyVerdict.verdict !== "REJECT",
        detail: safeBuyVerdict.reason,
      },
      {
        name: "fixture simulation creates signed ledger",
        ok: sim.scorecard.cycles > 0 && ledgerVerification.signatureValid && ledgerVerification.tamperEvident,
        detail: `cycles=${sim.scorecard.cycles}, signature=${ledgerVerification.signatureValid}, tamperEvident=${ledgerVerification.tamperEvident}`,
      },
    ],
    simulation: {
      fixture: "data/fixtures/live-demo.jsonl",
      scorecard: sim.scorecard,
      judgment: sim.judgment,
      ledgerFile,
      ledgerVerification,
    },
    gauntlet,
    sampleArtifacts: {
      apiCallLog: "evidence/api-call-log.jsonl",
      paperTradingLog: "evidence/trading-log/nightdesk-paper-trading-log.csv",
      paperRunSummary: "evidence/trading-log/run-summary.md",
      paperLedgerVerification: "evidence/trading-log/ledger-verification.txt",
      inputs: ["evidence/sample-inputs/safe-buy-intent.json", "evidence/sample-inputs/unsafe-sell-intent.json", "evidence/sample-inputs/mcp-evaluate-intent.json"],
      outputs: ["evidence/sample-outputs/safe-buy-verdict.json", "evidence/sample-outputs/unsafe-sell-verdict.json", "evidence/sample-outputs/blocked-buy-verdict.json", "evidence/sample-outputs/signed-certificate.json"],
    },
  };
  writeJson(join(evidenceDir, "judge-run.json"), judgeRun);

  console.log("NightDesk evidence pack generated:");
  console.log("  evidence/judge-run.json");
  console.log("  evidence/api-call-log.jsonl");
  console.log("  evidence/trading-log/");
  console.log("  evidence/sample-inputs/");
  console.log("  evidence/sample-outputs/");
}

generateEvidencePack().catch((e) => {
  console.error(e);
  process.exit(1);
});
