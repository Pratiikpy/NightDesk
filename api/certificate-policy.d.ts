export interface CertificatePolicySource {
  ticker: string;
  classification: string;
  safetyScore: number;
  policy: string;
  evidence: string[];
}

export interface CertificatePayloadData {
  version: "1.0";
  ticker: string;
  issuedAt: string;
  expiresAt: string;
  anchorSource: "NYSE_LIVE" | "LAST_CLOSE" | "NONE";
  anchorStale: boolean;
  classification: string;
  safetyScore: number;
  allowedPolicy: string;
  maxSizeUsd: number;
  evidence: string[];
}

export function impliedMaxSizeUsd(policy: string, safetyScore: number): number;
export function buildCertificatePayload(
  cert: CertificatePolicySource,
  options: {
    anchorSource: CertificatePayloadData["anchorSource"];
    anchorStale: boolean;
    now: number;
    ttlSec: number;
  },
): CertificatePayloadData;
