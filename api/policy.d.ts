export type PolicyVerdict = "ALLOW" | "ALLOW_CAPPED" | "REJECT";

export interface PolicyDecision {
  verdict: PolicyVerdict;
  reason: string;
  cappedSizeUsd?: number;
}

export interface IntentPolicyInput {
  hasCertificate: boolean;
  ticker: string;
  side: "buy" | "sell";
  sizeUsd: number;
  verification: { valid: boolean; reason: string };
  certificateTicker: string;
  allowedPolicy: string;
  maxSizeUsd: number;
}

export function evaluateIntentPolicy(input: IntentPolicyInput): PolicyDecision;
