// Canonical, dependency-free NightDesk intent policy.
//
// This module deliberately lives beside the serverless API so Vercel can load it without bundling.
// The canonical TypeScript kernel imports this exact function as well. Cryptographic verification is
// performed by each transport, but no transport owns verdict behavior.

const NON_TRADEABLE_POLICIES = new Set(["BLOCK", "AVOID", "ABSTAIN", "WATCH"]);

export function evaluateIntentPolicy(input) {
  if (!input.hasCertificate) {
    return { verdict: "REJECT", reason: "no certificate — proof-carrying intent required" };
  }
  if (!Number.isFinite(input.sizeUsd) || input.sizeUsd <= 0) {
    return { verdict: "REJECT", reason: "invalid sizeUsd — must be finite and positive" };
  }
  if (!input.verification.valid) {
    return { verdict: "REJECT", reason: `certificate ${input.verification.reason}` };
  }
  if (input.certificateTicker !== input.ticker) {
    return {
      verdict: "REJECT",
      reason: `certificate ticker mismatch (${input.certificateTicker} ≠ ${input.ticker})`,
    };
  }
  if (NON_TRADEABLE_POLICIES.has(input.allowedPolicy)) {
    return { verdict: "REJECT", reason: `policy ${input.allowedPolicy}: no trading permitted` };
  }
  if (input.allowedPolicy === "LONG-ONLY FADE" && input.side !== "buy") {
    return {
      verdict: "REJECT",
      reason: "policy LONG-ONLY FADE: only buys permitted (rToken not cleanly shortable)",
    };
  }
  if (!Number.isFinite(input.maxSizeUsd) || input.maxSizeUsd <= 0) {
    return { verdict: "REJECT", reason: "certificate max size is 0" };
  }
  if (input.sizeUsd > input.maxSizeUsd) {
    return {
      verdict: "ALLOW_CAPPED",
      reason: `size capped to certificate max $${input.maxSizeUsd}`,
      cappedSizeUsd: input.maxSizeUsd,
    };
  }
  return { verdict: "ALLOW", reason: "ok" };
}
