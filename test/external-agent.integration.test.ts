// External-agent integration test — proves the core infrastructure claim: ANY agent can use
// NightDesk as a safety gate, and CANNOT bypass it. The NaiveExternalAgent touches NightDesk only
// through the public contract (a TradeIntent + the firewall verdict) — no internal imports of the
// decision logic. Whether it executes is the firewall's call, never the agent's.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { issueCertificate, type NightDeskCertificate } from "../src/kernel/certificate";
import { evaluateIntent, type FirewallDecision } from "../src/kernel/firewall";
import type { TokenCert } from "../src/research/certify";

const T0 = Date.parse("2026-06-16T12:00:00.000Z");

/** A reckless external agent. It only knows the trade-intent contract + the firewall verdict. */
class NaiveExternalAgent {
  act(ticker: string, side: "buy" | "sell", certificate: NightDeskCertificate | undefined, now: number): FirewallDecision {
    // Always wants to slam an oversized trade; the firewall is the only thing in its way.
    return evaluateIntent({ ticker, side, sizeUsd: 1_000_000, certificate }, now);
  }
}

const tc = (over: Partial<TokenCert> = {}): TokenCert => ({
  ticker: "NVDA",
  trueGapPct: -2,
  perpGapPct: -0.1,
  classification: "MISPRICED",
  qualityGrade: "A",
  safetyScore: 90,
  policy: "LONG-ONLY FADE",
  evidence: [],
  ...over,
});
const issue = (over: Partial<TokenCert> = {}, anchorStale = false) =>
  issueCertificate(tc(over), { anchorSource: anchorStale ? "NONE" : "LAST_CLOSE", anchorStale, now: T0, ttlSec: 120 });

test("external agent: every unsafe path is rejected; only a safe certified buy passes (capped)", () => {
  const a = new NaiveExternalAgent();
  assert.equal(a.act("NVDA", "buy", undefined, T0).verdict, "REJECT", "1. no certificate");
  assert.equal(a.act("NVDA", "buy", issue(), T0 + 10_000_000).verdict, "REJECT", "2. expired");
  const base = issue();
  const tampered: NightDeskCertificate = { ...base, payload: { ...base.payload, allowedPolicy: "NORMAL", maxSizeUsd: 1e9 } };
  assert.equal(a.act("NVDA", "buy", tampered, T0 + 1000).verdict, "REJECT", "3. tampered");
  assert.equal(a.act("TSLA", "buy", issue(), T0 + 1000).verdict, "REJECT", "4. wrong ticker");
  assert.equal(a.act("NVDA", "buy", issue({ classification: "LIQUIDITY-TRAP", policy: "BLOCK" }), T0 + 1000).verdict, "REJECT", "5. liquidity-trap");
  assert.equal(a.act("NVDA", "buy", issue({}, true), T0 + 1000).verdict, "REJECT", "6. stale anchor");
  assert.equal(a.act("NVDA", "sell", issue(), T0 + 1000).verdict, "REJECT", "7. long-only + sell");
  const ok = a.act("NVDA", "buy", issue(), T0 + 1000);
  assert.equal(ok.verdict, "ALLOW_CAPPED", "8. safe + oversized → capped");
  assert.ok(ok.cappedSizeUsd! < 1_000_000, "the $1M request is capped to the certificate max");
});

test("agent-agnostic property: for ANY certificate, an external agent can never execute an unsafe trade", () => {
  fc.assert(
    fc.property(
      fc.constantFrom<TokenCert["policy"]>("NORMAL", "LONG-ONLY FADE", "WATCH", "ABSTAIN", "AVOID", "BLOCK"),
      fc.double({ min: 0, max: 100, noNaN: true }),
      fc.constantFrom<"buy" | "sell">("buy", "sell"),
      (policy, safetyScore, side) => {
        const cert = issue({ policy, safetyScore });
        const dec = new NaiveExternalAgent().act("NVDA", side, cert, T0 + 1000);
        if (dec.verdict === "REJECT") return true;
        const p = cert.payload.allowedPolicy;
        return (p === "NORMAL" || p === "LONG-ONLY FADE") && !(p === "LONG-ONLY FADE" && side === "sell");
      }
    )
  );
});
