// NightDesk live Agent Firewall — Vercel serverless function.
//
// Any agent (or a judge) can call this and get the REAL evaluateIntent verdict over the internet:
//   GET  /api/firewall?ticker=NVDA&side=buy&sizeUsd=50
//   POST /api/firewall   { "ticker": "NVDA", "side": "buy", "sizeUsd": 50 }
//
// Verdicts are computed from NightDesk's latest recorded snapshot (api/firewall-universe.json). A fresh
// certificate is signed PER REQUEST with an ephemeral Ed25519 key, so the secret attestation key is
// never deployed — verifyCertificate checks the certificate's own embedded public key. This is the same
// issueCertificate + evaluateIntent pipeline the live desk and the test suite use.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { issueCertificate } from "../src/kernel/certificate";
import { evaluateIntent } from "../src/kernel/firewall";
import { generateKeypair } from "../src/ledger/attest";

let CACHE: any = null;
function universe(): any {
  if (!CACHE) CACHE = JSON.parse(readFileSync(join(process.cwd(), "api", "firewall-universe.json"), "utf8"));
  return CACHE;
}

export default function handler(req: any, res: any): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const ticker = String(body.ticker ?? q.ticker ?? "").toUpperCase().trim();
  const side = (body.side ?? q.side) === "sell" ? "sell" : "buy";
  const sizeUsd = Number(body.sizeUsd ?? q.sizeUsd ?? 0);
  const data = universe();
  const known = data.universe.map((e: any) => e.ticker);

  if (!ticker) {
    res.statusCode = 400;
    res.end(JSON.stringify({ verdict: "REJECT", reason: "missing ticker — try ?ticker=NVDA&side=buy&sizeUsd=50", knownTickers: known }, null, 2));
    return;
  }
  const entry = data.universe.find((e: any) => e.ticker === ticker);
  if (!entry) {
    res.end(JSON.stringify({ verdict: "REJECT", reason: `unknown ticker ${ticker}`, knownTickers: known }, null, 2));
    return;
  }

  const cert = issueCertificate(entry.cert, { anchorSource: entry.anchorSource, anchorStale: entry.anchorStale, keys: generateKeypair() });
  const dec = evaluateIntent({ ticker, side, sizeUsd, certificate: cert });
  res.end(JSON.stringify({
    verdict: dec.verdict,
    reason: dec.reason,
    cappedSizeUsd: dec.cappedSizeUsd ?? null,
    intent: { ticker, side, sizeUsd },
    certificate: {
      classification: cert.payload.classification,
      allowedPolicy: cert.payload.allowedPolicy,
      safetyScore: cert.payload.safetyScore,
      maxSizeUsd: cert.payload.maxSizeUsd,
      anchorSource: cert.payload.anchorSource,
      expiresAt: cert.payload.expiresAt,
    },
    snapshotAt: data.snapshotAt,
    note: "Live NightDesk Agent Firewall. Verdict from the latest recorded snapshot; certificate freshly signed per request (ephemeral key).",
  }, null, 2));
}
