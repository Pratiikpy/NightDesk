// NightDesk live Agent Firewall — self-contained Vercel serverless function.
//
//   GET  /api/firewall?ticker=NVDA&side=buy&sizeUsd=50
//   POST /api/firewall   { "ticker": "NVDA", "side": "buy", "sizeUsd": 50 }
//
// Self-contained ON PURPOSE: Vercel runs functions as native Node ESM WITHOUT bundling, and the rest of
// the codebase uses extensionless imports (great for tsx, unresolvable at Vercel runtime). So this file
// imports only node:crypto, the leaf data module, and the dependency-free canonical policy module that
// is also used by src/kernel/firewall.ts. Verdicts are computed from the latest recorded snapshot; a
// certificate is freshly issued and Ed25519-signed PER REQUEST (ephemeral key), so the secret
// attestation key is never deployed.
import { generateKeyPairSync, sign as edSign, verify as edVerify, createHash } from "node:crypto";
import { universe, snapshotAt } from "./firewall-universe.js";
import { evaluateIntentPolicy } from "./policy.js";
import { buildCertificatePayload } from "./certificate-policy.js";

function evaluate(entry: any, side: string, sizeUsd: number, now: number) {
  const payload = buildCertificatePayload(entry.cert, {
    anchorSource: entry.anchorSource,
    anchorStale: Boolean(entry.anchorStale),
    now,
    ttlSec: 120,
  });
  // genuinely sign + verify the certificate (Ed25519 over sha256(JSON([payload]))) — same primitive as the ledger
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const hash = createHash("sha256").update(JSON.stringify([payload])).digest("hex");
  const sigHex = edSign(null, Buffer.from(hash, "hex"), privateKey).toString("hex");
  const sigOk = edVerify(null, Buffer.from(hash, "hex"), publicKey, Buffer.from(sigHex, "hex"));

  const dec = evaluateIntentPolicy({
    hasCertificate: true,
    ticker: entry.cert.ticker,
    side: side === "sell" ? "sell" : "buy",
    sizeUsd,
    verification: sigOk
      ? { valid: true, reason: "ok" }
      : { valid: false, reason: "signature invalid or payload tampered" },
    certificateTicker: payload.ticker,
    allowedPolicy: payload.allowedPolicy,
    maxSizeUsd: payload.maxSizeUsd,
  });
  return { dec, payload };
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
  try {
    const q = req.query || {};
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const ticker = String(body.ticker ?? q.ticker ?? "").toUpperCase().trim();
    const side = (body.side ?? q.side) === "sell" ? "sell" : "buy";
    const sizeUsd = Number(body.sizeUsd ?? q.sizeUsd ?? 0);
    const list = universe as any[];
    const known = list.map((e) => e.ticker);

    if (!ticker) {
      res.statusCode = 400;
      res.end(JSON.stringify({ verdict: "REJECT", reason: "missing ticker — try ?ticker=NVDA&side=buy&sizeUsd=50", knownTickers: known }, null, 2));
      return;
    }
    const entry = list.find((e) => e.ticker === ticker);
    if (!entry) {
      res.end(JSON.stringify({ verdict: "REJECT", reason: `unknown ticker ${ticker}`, knownTickers: known }, null, 2));
      return;
    }
    const { dec, payload } = evaluate(entry, side, sizeUsd, Date.now());
    res.end(JSON.stringify({
      verdict: dec.verdict,
      reason: dec.reason,
      cappedSizeUsd: dec.cappedSizeUsd ?? null,
      intent: { ticker, side, sizeUsd },
      certificate: {
        classification: payload.classification,
        allowedPolicy: payload.allowedPolicy,
        safetyScore: payload.safetyScore,
        maxSizeUsd: payload.maxSizeUsd,
        anchorSource: payload.anchorSource,
        expiresAt: payload.expiresAt,
      },
      snapshotAt,
      note: "Live NightDesk Agent Firewall. Verdict from the latest recorded snapshot; certificate freshly issued and Ed25519-signed per request.",
    }, null, 2));
  } catch (e: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e && e.message ? e.message : e), where: "firewall handler" }, null, 2));
  }
}
