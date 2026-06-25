// NightDesk Safety Kernel — the certificate.
//
// A NightDeskCertificate is a signed, expiring, evidence-hashed statement about ONE tokenized stock:
// its classification, safety score, and the ONLY policy an agent is permitted to act under. It is the
// unit the Agent Firewall enforces: no valid certificate → no trade. Reuses the tested Ed25519 attest
// primitives (the payload is signed as a one-element batch), so verification is the same code path as
// the ledger. This turns "NightDesk says X is safe" into "prove it, with a signature that expires."
import { attest, verifyAttestation, type Attestation, type Keypair } from "../ledger/attest";
import type { TokenCert, CertLabel, CertPolicy } from "../research/certify";
import {
  buildCertificatePayload,
  impliedMaxSizeUsd as canonicalImpliedMaxSizeUsd,
} from "../../api/certificate-policy.js";

export interface CertPayload {
  version: "1.0";
  ticker: string;
  issuedAt: string; // ISO
  expiresAt: string; // ISO — a certificate cannot outlive its market snapshot
  anchorSource: "NYSE_LIVE" | "LAST_CLOSE" | "NONE";
  anchorStale: boolean;
  classification: CertLabel;
  safetyScore: number;
  allowedPolicy: CertPolicy;
  maxSizeUsd: number; // size cap implied by the safety score (0 ⇒ no trading)
  evidence: string[];
}

export interface NightDeskCertificate {
  payload: CertPayload;
  attestation: Attestation; // Ed25519 signature over [payload]
}

/** Size cap implied by the safety score — higher safety earns more size; unsafe earns zero. */
export function impliedMaxSizeUsd(policy: CertPolicy, safetyScore: number): number {
  return canonicalImpliedMaxSizeUsd(policy, safetyScore);
}

export function issueCertificate(cert: TokenCert, opts: { anchorSource: CertPayload["anchorSource"]; anchorStale: boolean; now?: number; ttlSec?: number; keys?: Keypair }): NightDeskCertificate {
  const now = opts.now ?? Date.now();
  const ttlSec = opts.ttlSec ?? 120; // 2 min — short, because off-hours quotes go stale
  const payload = buildCertificatePayload(cert, {
    anchorSource: opts.anchorSource,
    anchorStale: opts.anchorStale,
    now,
    ttlSec,
  }) as CertPayload;
  return { payload, attestation: attest([payload], opts.keys) };
}

export interface CertVerification {
  valid: boolean;
  reason: string;
}

/** Verify a certificate: signature intact (not tampered) AND not expired. */
export function verifyCertificate(cert: NightDeskCertificate, now = Date.now()): CertVerification {
  if (!verifyAttestation([cert.payload], cert.attestation)) return { valid: false, reason: "signature invalid or payload tampered" };
  if (now < Date.parse(cert.payload.issuedAt)) return { valid: false, reason: `not valid before ${cert.payload.issuedAt}` };
  if (now > Date.parse(cert.payload.expiresAt)) return { valid: false, reason: `expired at ${cert.payload.expiresAt}` };
  return { valid: true, reason: "ok" };
}

// ── Market-integrity invariants — hard rules a certificate must NEVER violate ──
// These are the laws of the safety kernel. The fuzz test asserts the issuer never breaks them over
// thousands of random (incl. toxic) market states.
const isTradeablePolicy = (p: CertPolicy) => p === "NORMAL" || p === "LONG-ONLY FADE";

export function checkInvariants(p: CertPayload): string[] {
  const v: string[] = [];
  const tradeable = isTradeablePolicy(p.allowedPolicy);
  if (p.anchorStale && tradeable) v.push("STALE_ANCHOR_MUST_NOT_BE_TRADEABLE");
  if (p.classification === "STALE" && tradeable) v.push("STALE_CANNOT_TRADE");
  if (p.classification === "LIQUIDITY-TRAP" && p.allowedPolicy !== "BLOCK") v.push("LIQUIDITY_TRAP_MUST_BLOCK");
  if (p.classification === "NEWS-DRIVEN" && tradeable) v.push("NEWS_CANNOT_BE_TRADEABLE");
  if (p.classification === "MACRO-RISK" && tradeable) v.push("MACRO_CANNOT_BE_TRADEABLE");
  if (p.safetyScore < 0 || p.safetyScore > 100) v.push("SAFETY_SCORE_OUT_OF_RANGE");
  if (!tradeable && p.maxSizeUsd > 0) v.push("NON_TRADEABLE_MUST_HAVE_ZERO_SIZE");
  if (Date.parse(p.expiresAt) <= Date.parse(p.issuedAt)) v.push("CERT_MUST_EXPIRE_AFTER_ISSUE");
  return v;
}
