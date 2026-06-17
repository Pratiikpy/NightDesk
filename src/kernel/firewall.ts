// NightDesk Safety Kernel — the Agent Firewall.
//
// Proof-carrying trade intents: any agent's intent to trade a tokenized stock MUST carry a valid,
// unexpired, matching NightDeskCertificate, and may only act within the certificate's allowed policy.
// evaluateIntent is the deterministic gate — the LLM council may debate, but this verdict is cold,
// mechanical, and boring. Boring saves accounts. This is the layer that turns NightDesk from "an
// agent" into "the gate every agent passes through."
import { verifyCertificate, type NightDeskCertificate } from "./certificate";

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
  if (!cert) return { verdict: "REJECT", reason: "no certificate — proof-carrying intent required" };
  if (!Number.isFinite(intent.sizeUsd) || intent.sizeUsd <= 0) {
    return { verdict: "REJECT", reason: "invalid sizeUsd — must be finite and positive" };
  }

  const v = verifyCertificate(cert, now);
  if (!v.valid) return { verdict: "REJECT", reason: `certificate ${v.reason}` };

  if (cert.payload.ticker !== intent.ticker) {
    return { verdict: "REJECT", reason: `certificate ticker mismatch (${cert.payload.ticker} ≠ ${intent.ticker})` };
  }

  const policy = cert.payload.allowedPolicy;
  if (policy === "BLOCK" || policy === "AVOID" || policy === "ABSTAIN" || policy === "WATCH") {
    return { verdict: "REJECT", reason: `policy ${policy}: no trading permitted` };
  }
  if (policy === "LONG-ONLY FADE" && intent.side !== "buy") {
    return { verdict: "REJECT", reason: "policy LONG-ONLY FADE: only buys permitted (rToken not cleanly shortable)" };
  }

  const cap = cert.payload.maxSizeUsd;
  if (cap <= 0) return { verdict: "REJECT", reason: "certificate max size is 0" };
  if (intent.sizeUsd > cap) return { verdict: "ALLOW_CAPPED", reason: `size capped to certificate max $${cap}`, cappedSizeUsd: cap };
  return { verdict: "ALLOW", reason: "ok" };
}
