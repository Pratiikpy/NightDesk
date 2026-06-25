const NON_TRADEABLE_POLICIES = new Set(["BLOCK", "AVOID", "ABSTAIN", "WATCH"]);

export function impliedMaxSizeUsd(policy, safetyScore) {
  if (NON_TRADEABLE_POLICIES.has(policy)) return 0;
  return Math.max(0, Math.round(((safetyScore - 60) / 40) * 100));
}

export function buildCertificatePayload(cert, options) {
  const classification = options.anchorStale ? "STALE" : cert.classification;
  const allowedPolicy = options.anchorStale ? "ABSTAIN" : cert.policy;
  return {
    version: "1.0",
    ticker: cert.ticker,
    issuedAt: new Date(options.now).toISOString(),
    expiresAt: new Date(options.now + options.ttlSec * 1000).toISOString(),
    anchorSource: options.anchorSource,
    anchorStale: options.anchorStale,
    classification,
    safetyScore: cert.safetyScore,
    allowedPolicy,
    maxSizeUsd: impliedMaxSizeUsd(allowedPolicy, cert.safetyScore),
    evidence: cert.evidence,
  };
}
