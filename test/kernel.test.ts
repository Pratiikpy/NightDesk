import { test } from "node:test";
import assert from "node:assert/strict";
import { issueCertificate, verifyCertificate, checkInvariants, type NightDeskCertificate } from "../src/kernel/certificate";
import { evaluateIntent } from "../src/kernel/firewall";
import { certifyToken, type TokenCert } from "../src/research/certify";
import { mulberry32 } from "../src/history/study";
import type { PegRow } from "../src/pegwatch/collect";
import type { PerceptionContext } from "../src/perception/events";

const T0 = Date.parse("2026-06-16T12:00:00.000Z");
const tokenCert = (over: Partial<TokenCert> = {}): TokenCert => ({
  ticker: "NVDA",
  trueGapPct: -2,
  perpGapPct: -0.1,
  classification: "MISPRICED",
  qualityGrade: "B",
  safetyScore: 90,
  policy: "LONG-ONLY FADE",
  evidence: ["cheap"],
  ...over,
});
const issue = (over: Partial<TokenCert> = {}, stale = false) =>
  issueCertificate(tokenCert(over), { anchorSource: stale ? "NONE" : "LAST_CLOSE", anchorStale: stale, now: T0, ttlSec: 120 });

test("certificate: issue → verify valid before expiry", () => {
  assert.equal(verifyCertificate(issue(), T0 + 60_000).valid, true);
});

test("certificate: expires after its TTL", () => {
  const v = verifyCertificate(issue(), T0 + 200_000);
  assert.equal(v.valid, false);
  assert.match(v.reason, /expired/);
});

test("certificate: tampering the payload invalidates the signature", () => {
  const c = issue();
  const tampered: NightDeskCertificate = { ...c, payload: { ...c.payload, maxSizeUsd: 9999, allowedPolicy: "NORMAL" } };
  assert.equal(verifyCertificate(tampered, T0 + 10_000).valid, false);
});

test("issuer enforces its own law: a stale anchor is never tradeable", () => {
  const c = issue({ classification: "MISPRICED", policy: "LONG-ONLY FADE" }, true);
  assert.equal(c.payload.classification, "STALE");
  assert.equal(c.payload.allowedPolicy, "ABSTAIN");
  assert.equal(c.payload.maxSizeUsd, 0);
  assert.deepEqual(checkInvariants(c.payload), []);
});

test("firewall: no certificate → REJECT", () => {
  assert.equal(evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd: 10 }, T0).verdict, "REJECT");
});

test("firewall: expired / mismatched-ticker → REJECT", () => {
  assert.equal(evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd: 10, certificate: issue() }, T0 + 200_000).verdict, "REJECT");
  assert.equal(evaluateIntent({ ticker: "TSLA", side: "buy", sizeUsd: 10, certificate: issue() }, T0 + 1000).verdict, "REJECT");
});

test("firewall: non-tradeable policies (BLOCK/ABSTAIN/AVOID/WATCH) → REJECT", () => {
  for (const policy of ["BLOCK", "ABSTAIN", "AVOID", "WATCH"] as const) {
    const dec = evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd: 10, certificate: issue({ policy, classification: "FAIR" }) }, T0 + 1000);
    assert.equal(dec.verdict, "REJECT", `${policy} should reject`);
  }
});

test("firewall: LONG-ONLY FADE rejects sells, allows capped buys", () => {
  const c = issue({ policy: "LONG-ONLY FADE", safetyScore: 90 }); // cap = (90-60)/40*100 = 75
  assert.equal(evaluateIntent({ ticker: "NVDA", side: "sell", sizeUsd: 10, certificate: c }, T0 + 1000).verdict, "REJECT");
  assert.equal(evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd: 10, certificate: c }, T0 + 1000).verdict, "ALLOW");
  const capped = evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd: 999, certificate: c }, T0 + 1000);
  assert.equal(capped.verdict, "ALLOW_CAPPED");
  assert.equal(capped.cappedSizeUsd, 75);
});

// ── FUZZ: thousands of random, often-toxic market states ──
const macro = (active: boolean): PerceptionContext["macro"] => ({ active, date: "", events: active ? ["CPI"] : [], severity: active ? "high" : "low", summary: "" });
const news = (fresh: boolean): PerceptionContext["news"] => ({ fresh, count: 0, relevantCount: 0, matched: fresh ? ["earnings"] : [], latestTitle: null, summary: "" });

function randomState(rng: () => number, i: number) {
  const hasEq = rng() > 0.2;
  const trueGap = rng() * 12 - 6;
  const hasR = rng() > 0.1;
  const book = rng() > 0.5 ? Math.floor(rng() * 20) : 0;
  const ms = rng() > 0.6 ? "CLOSED" : rng() > 0.5 ? "REGULAR" : "UNKNOWN";
  const stale = !hasEq || ms === "UNKNOWN";
  const absG = Math.abs(trueGap);
  const row = {
    ticker: "T" + i,
    rToken: hasR ? { symbol: "R", bid: 1, ask: 1, last: 1, mid: 100 + rng() * 50, ts: 1, bookLevels: book } : null,
    perp: { symbol: "P", bid: 1, ask: 1, last: 1, mid: 100 + rng() * 50, ts: 1, funding: 0 },
    ondo: null,
    premiumPct: rng() * 4 - 2,
    state: "NORMAL",
    tradeable: true,
    triangulation: rng() > 0.85 ? { rPerpPct: 1, ondoPerpPct: -1, rOndoPct: 2, maxDisagreementPct: 2, flagged: true } : null,
    equity: hasEq ? { price: 100 + rng() * 50, previousClose: 100, marketState: ms, asOf: 1 } : null,
    premiumVsEquityPct: hasEq ? trueGap : null,
    stateVsEquity: hasEq ? (absG >= 2 ? "DISLOCATED" : absG >= 0.5 ? "STRETCHED" : "NORMAL") : null,
  } as unknown as PegRow;
  const ctx: PerceptionContext = { ticker: row.ticker, macro: macro(rng() > 0.85), news: news(rng() > 0.7), severity: "none", abstainRecommended: false, summary: "" };
  const anchorSource = !hasEq ? "NONE" : ms === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE";
  return { row, ctx, anchorStale: stale, anchorSource: anchorSource as "NONE" | "NYSE_LIVE" | "LAST_CLOSE" };
}

test("invariants are not vacuous: a hand-crafted violating payload is caught", () => {
  const bad = {
    version: "1.0" as const,
    ticker: "X",
    issuedAt: new Date(T0).toISOString(),
    expiresAt: new Date(T0 + 120_000).toISOString(),
    anchorSource: "LAST_CLOSE" as const,
    anchorStale: false,
    classification: "LIQUIDITY-TRAP" as const, // must BLOCK …
    safetyScore: 150, // … and is out of range
    allowedPolicy: "NORMAL" as const, // … but says tradeable
    maxSizeUsd: 50, // … with non-zero size
    evidence: [],
  };
  const violations = checkInvariants(bad);
  assert.ok(violations.includes("LIQUIDITY_TRAP_MUST_BLOCK"));
  assert.ok(violations.includes("SAFETY_SCORE_OUT_OF_RANGE"));
  assert.ok(violations.length >= 2);
});

test("FUZZ: 5000 random/toxic states — invariants always hold and the firewall never allows an unsafe trade", () => {
  const rng = mulberry32(987654);
  const grades = ["A", "B", "C", "D", "?"];
  for (let i = 0; i < 5000; i++) {
    const { row, ctx, anchorStale, anchorSource } = randomState(rng, i);
    const tc = certifyToken(row, ctx, grades[Math.floor(rng() * grades.length)]);
    const cert = issueCertificate(tc, { anchorSource, anchorStale, now: T0, ttlSec: 120 });
    assert.deepEqual(checkInvariants(cert.payload), [], `invariant violated @${i}: ${JSON.stringify(cert.payload)}`);
    for (const side of ["buy", "sell"] as const) {
      const dec = evaluateIntent({ ticker: row.ticker, side, sizeUsd: 1000, certificate: cert }, T0 + 1000);
      if (dec.verdict !== "REJECT") {
        const p = cert.payload.allowedPolicy;
        assert.ok(p === "NORMAL" || p === "LONG-ONLY FADE", `firewall allowed an unsafe policy ${p} @${i}`);
        if (p === "LONG-ONLY FADE") assert.equal(side, "buy", `long-only allowed a sell @${i}`);
      }
    }
  }
});
