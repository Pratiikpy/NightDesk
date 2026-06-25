import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/firewall";
import { universe } from "../api/firewall-universe";
import { evaluateIntentPolicy, type IntentPolicyInput } from "../api/policy.js";
import { buildCertificatePayload } from "../api/certificate-policy.js";
import { issueCertificate, verifyCertificate } from "../src/kernel/certificate";
import { evaluateIntent } from "../src/kernel/firewall";
import type { TokenCert } from "../src/research/certify";

const T0 = Date.parse("2026-06-24T12:00:00.000Z");

function token(over: Partial<TokenCert> = {}): TokenCert {
  return {
    ticker: "NVDA",
    trueGapPct: -1,
    perpGapPct: 0,
    classification: "MISPRICED",
    qualityGrade: "A",
    safetyScore: 90,
    policy: "LONG-ONLY FADE",
    evidence: ["parity"],
    ...over,
  };
}

function compareKernel(input: {
  token?: Partial<TokenCert>;
  ticker?: string;
  side?: "buy" | "sell";
  sizeUsd?: number;
  certificate?: boolean;
  now?: number;
}): void {
  const cert = input.certificate === false
    ? undefined
    : issueCertificate(token(input.token), {
        anchorSource: "LAST_CLOSE",
        anchorStale: false,
        now: T0,
        ttlSec: 120,
      });
  const intent = {
    ticker: input.ticker ?? "NVDA",
    side: input.side ?? "buy",
    sizeUsd: input.sizeUsd ?? 10,
    ...(cert ? { certificate: cert } : {}),
  };
  const verification = cert ? verifyCertificate(cert, input.now ?? T0 + 1000) : { valid: false, reason: "missing" };
  const normalized: IntentPolicyInput = {
    hasCertificate: cert != null,
    ticker: intent.ticker,
    side: intent.side,
    sizeUsd: intent.sizeUsd,
    verification,
    certificateTicker: cert?.payload.ticker ?? "",
    allowedPolicy: cert?.payload.allowedPolicy ?? "BLOCK",
    maxSizeUsd: cert?.payload.maxSizeUsd ?? 0,
  };
  assert.deepEqual(evaluateIntent(intent, input.now ?? T0 + 1000), evaluateIntentPolicy(normalized));
}

test("transport parity: canonical kernel adapter matches the shared policy corpus", () => {
  compareKernel({ certificate: false });
  compareKernel({ sizeUsd: Number.NaN });
  compareKernel({ ticker: "TSLA" });
  compareKernel({ token: { policy: "BLOCK", classification: "LIQUIDITY-TRAP" } });
  compareKernel({ side: "sell" });
  compareKernel({ sizeUsd: 999 });
  compareKernel({ sizeUsd: 10 });
  compareKernel({ now: T0 + 300_000 });
});

test("transport parity: canonical certificate payload matches the transport-safe builder", () => {
  const source = token({ safetyScore: 88, policy: "LONG-ONLY FADE" });
  const certificate = issueCertificate(source, {
    anchorSource: "LAST_CLOSE",
    anchorStale: false,
    now: T0,
    ttlSec: 120,
  });
  assert.deepEqual(
    certificate.payload,
    buildCertificatePayload(source, {
      anchorSource: "LAST_CLOSE",
      anchorStale: false,
      now: T0,
      ttlSec: 120,
    }),
  );
});

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function callHttp(query: Record<string, unknown>): Record<string, any> {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body = "") {
      this.body = body;
    },
  };
  handler({ method: "GET", query }, response);
  return JSON.parse(response.body) as Record<string, any>;
}

test("transport parity: deployed HTTP adapter returns the canonical policy verdict", () => {
  const ticker = universe[0]!.ticker;
  for (const side of ["buy", "sell"] as const) {
    for (const sizeUsd of [0, 10, 1000]) {
      const output = callHttp({ ticker, side, sizeUsd });
      const cert = output.certificate as { allowedPolicy: string; maxSizeUsd: number };
      const expected = evaluateIntentPolicy({
        hasCertificate: true,
        ticker,
        side,
        sizeUsd,
        verification: { valid: true, reason: "ok" },
        certificateTicker: ticker,
        allowedPolicy: cert.allowedPolicy,
        maxSizeUsd: cert.maxSizeUsd,
      });
      assert.equal(output.verdict, expected.verdict);
      assert.equal(output.reason, expected.reason);
      assert.equal(output.cappedSizeUsd, expected.cappedSizeUsd ?? null);
    }
  }
});
