import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { issueCertificate, type NightDeskCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { TokenCert } from "../research/certify";

const T0 = Date.parse("2026-06-16T12:00:00.000Z");

const baseToken = (over: Partial<TokenCert> = {}): TokenCert => ({
  ticker: "NVDA",
  trueGapPct: -2,
  perpGapPct: -0.1,
  classification: "MISPRICED",
  qualityGrade: "A",
  safetyScore: 90,
  policy: "LONG-ONLY FADE",
  evidence: ["redteam fixture"],
  ...over,
});

function cert(over: Partial<TokenCert> = {}, opts: { stale?: boolean; ttlSec?: number } = {}): NightDeskCertificate {
  return issueCertificate(baseToken(over), {
    anchorSource: opts.stale ? "NONE" : "LAST_CLOSE",
    anchorStale: !!opts.stale,
    now: T0,
    ttlSec: opts.ttlSec ?? 120,
  });
}

export function runRedteam(): void {
  const good = cert();
  const tampered: NightDeskCertificate = { ...good, payload: { ...good.payload, ticker: "NVDA\u0430" } };
  const cases = [
    { case_id: "malformed_missing_ticker", intent: { side: "buy", sizeUsd: 50, certificate: good }, expected: "REJECT" },
    { case_id: "unicode_ticker_spoof", intent: { ticker: "NVDA\u0430", side: "buy", sizeUsd: 50, certificate: good }, expected: "REJECT" },
    { case_id: "negative_notional", intent: { ticker: "NVDA", side: "buy", sizeUsd: -1, certificate: good }, expected: "REJECT" },
    { case_id: "nan_notional", intent: { ticker: "NVDA", side: "buy", sizeUsd: Number.NaN, certificate: good }, expected: "REJECT" },
    { case_id: "infinite_notional", intent: { ticker: "NVDA", side: "buy", sizeUsd: Number.POSITIVE_INFINITY, certificate: good }, expected: "REJECT" },
    { case_id: "huge_notional_caps", intent: { ticker: "NVDA", side: "buy", sizeUsd: 1e12, certificate: good }, expected: "ALLOW_CAPPED" },
    { case_id: "expired_certificate", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: cert({}, { ttlSec: 1 }) }, now: T0 + 2_000, expected: "REJECT" },
    { case_id: "future_timestamp_safe_cert", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: good }, now: T0 - 10_000, expected: "REJECT" },
    { case_id: "tampered_certificate", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: tampered }, expected: "REJECT" },
    { case_id: "liquidity_trap_cert", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: cert({ classification: "LIQUIDITY-TRAP", policy: "BLOCK" }) }, expected: "REJECT" },
    { case_id: "macro_cert", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: cert({ classification: "MACRO-RISK", policy: "ABSTAIN" }) }, expected: "REJECT" },
    { case_id: "news_cert", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: cert({ classification: "NEWS-DRIVEN", policy: "ABSTAIN" }) }, expected: "REJECT" },
    { case_id: "stale_anchor_cert", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, certificate: cert({}, { stale: true }) }, expected: "REJECT" },
    { case_id: "wrong_side_policy", intent: { ticker: "NVDA", side: "sell", sizeUsd: 50, certificate: good }, expected: "REJECT" },
    { case_id: "script_injection_ticker", intent: { ticker: "<script>NVDA</script>", side: "buy", sizeUsd: 50, certificate: good }, expected: "REJECT" },
  ].map((c) => {
    const response = evaluateIntent(c.intent as Parameters<typeof evaluateIntent>[0], c.now ?? T0 + 1000);
    const pass = response.verdict === c.expected;
    return { ...c, response, pass };
  });
  const unsafeAllowed = cases.filter((c) => c.expected === "REJECT" && c.response.verdict !== "REJECT");
  const ok = cases.every((c) => c.pass) && unsafeAllowed.length === 0;
  const out = join(process.cwd(), "evidence", "redteam");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "redteam-results.jsonl"), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
  writeFileSync(join(out, "redteam-report.md"), [
    "# NightDesk Red-Team Report",
    "",
    `Status: ${ok ? "PASS" : "FAIL"}`,
    `Cases: ${cases.length}`,
    `Unsafe allowed: ${unsafeAllowed.length}`,
    "",
  ].join("\n"));
  console.log(`NIGHTDESK REDTEAM ${ok ? "PASS" : "FAIL"}`);
  console.log(`cases=${cases.length} unsafe_allowed=${unsafeAllowed.length}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("redteam.ts")) runRedteam();
