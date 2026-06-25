// NightDesk Safety Kernel — the Agent Firewall.
//
// Proof-carrying trade intents: any agent's intent to trade a tokenized stock MUST carry a valid,
// unexpired, matching NightDeskCertificate, and may only act within the certificate's allowed policy.
// evaluateIntent is the deterministic gate — the LLM council may debate, but this verdict is cold,
// mechanical, and boring. Boring saves accounts. This is the layer that turns NightDesk from "an
// agent" into "the gate every agent passes through."
import { verifyCertificate, type NightDeskCertificate } from "./certificate";
import { evaluateIntentPolicy } from "../../api/policy.js";

export interface TradeIntent {
  ticker: string;
  side: "buy" | "sell";
  sizeUsd: number;
  certificate?: NightDeskCertificate;
}

export type Verdict = "ALLOW" | "ALLOW_CAPPED" | "REJECT";

export interface FirewallDecision {
  verdict: Verdict;
  reason: string;
  cappedSizeUsd?: number;
}

export function evaluateIntent(intent: TradeIntent, now = Date.now()): FirewallDecision {
  const cert = intent.certificate;
  const verification = cert
    ? verifyCertificate(cert, now)
    : { valid: false, reason: "missing" };
  return evaluateIntentPolicy({
    hasCertificate: cert != null,
    ticker: intent.ticker,
    side: intent.side,
    sizeUsd: intent.sizeUsd,
    verification,
    certificateTicker: cert?.payload.ticker ?? "",
    allowedPolicy: cert?.payload.allowedPolicy ?? "BLOCK",
    maxSizeUsd: cert?.payload.maxSizeUsd ?? 0,
  });
}
