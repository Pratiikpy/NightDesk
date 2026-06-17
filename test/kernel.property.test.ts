// Property-based tests for the Safety Kernel (fast-check). These complement — not replace — the
// seeded 5k fuzz in kernel.test.ts: fast-check generates toxic market states and, on failure,
// SHRINKS to a minimal counterexample (e.g. "anchorStale=true, policy=LONG-ONLY FADE"), which is
// far more useful to a reviewer than "seed 392019 failed at state 2718". Scope: the kernel
// invariants + firewall safety only. The core claim is a PROPERTY: unsafe intents never pass.
import { test } from "node:test";
import fc from "fast-check";
import { issueCertificate, verifyCertificate, checkInvariants } from "../src/kernel/certificate";
import { evaluateIntent } from "../src/kernel/firewall";
import { certifyToken, type TokenCert } from "../src/research/certify";
import type { PegRow } from "../src/pegwatch/collect";
import type { PerceptionContext } from "../src/perception/events";

const T0 = Date.parse("2026-06-16T12:00:00.000Z");

interface State {
  hasEq: boolean;
  trueGap: number;
  hasR: boolean;
  book: number;
  ms: string;
  news: boolean;
  macro: boolean;
  grade: string;
  rMid: number;
}

const stateArb = fc.record<State>({
  hasEq: fc.boolean(),
  trueGap: fc.double({ min: -8, max: 8, noNaN: true }),
  hasR: fc.boolean(),
  book: fc.nat({ max: 20 }),
  ms: fc.constantFrom("CLOSED", "REGULAR", "UNKNOWN", "PRE", "POST"),
  news: fc.boolean(),
  macro: fc.boolean(),
  grade: fc.constantFrom("A", "B", "C", "D", "?"),
  rMid: fc.double({ min: 1, max: 500, noNaN: true }),
});

function build(s: State) {
  const absG = Math.abs(s.trueGap);
  const row = {
    ticker: "T",
    rToken: s.hasR ? { symbol: "R", bid: 1, ask: 1, last: 1, mid: s.rMid, ts: 1, bookLevels: s.book } : null,
    perp: { symbol: "P", bid: 1, ask: 1, last: 1, mid: s.rMid, ts: 1, funding: 0 },
    ondo: null,
    premiumPct: 0,
    state: "NORMAL",
    tradeable: true,
    triangulation: null,
    equity: s.hasEq ? { price: s.rMid / (1 + s.trueGap / 100), previousClose: 0, marketState: s.ms, asOf: 1 } : null,
    premiumVsEquityPct: s.hasEq ? s.trueGap : null,
    stateVsEquity: s.hasEq ? (absG > 2 ? "DISLOCATED" : absG >= 0.5 ? "STRETCHED" : "NORMAL") : null,
  } as unknown as PegRow;
  const ctx: PerceptionContext = {
    ticker: "T",
    macro: { active: s.macro, date: "", events: s.macro ? ["CPI"] : [], severity: s.macro ? "high" : "low", summary: "" },
    news: { fresh: s.news, count: 0, relevantCount: 0, matched: s.news ? ["earnings"] : [], latestTitle: null, summary: "" },
    severity: "none",
    abstainRecommended: false,
    summary: "",
  };
  return { row, ctx, anchorStale: !s.hasEq, anchorSource: (!s.hasEq ? "NONE" : s.ms === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE") as "NONE" | "NYSE_LIVE" | "LAST_CLOSE" };
}

test("PROPERTY: issuer never violates a kernel invariant, and the firewall never allows an unsafe trade", () => {
  fc.assert(
    fc.property(stateArb, (s) => {
      const { row, ctx, anchorStale, anchorSource } = build(s);
      const cert = issueCertificate(certifyToken(row, ctx, s.grade), { anchorSource, anchorStale, now: T0, ttlSec: 120 });
      if (checkInvariants(cert.payload).length !== 0) return false;
      for (const side of ["buy", "sell"] as const) {
        const dec = evaluateIntent({ ticker: row.ticker, side, sizeUsd: 1000, certificate: cert }, T0 + 1000);
        if (dec.verdict !== "REJECT") {
          const p = cert.payload.allowedPolicy;
          if (!(p === "NORMAL" || p === "LONG-ONLY FADE")) return false; // unsafe policy was allowed
          if (p === "LONG-ONLY FADE" && side === "sell") return false; // long-only allowed a sell
        }
      }
      return true;
    }),
    { numRuns: 2000 }
  );
});

// A baseline valid, tradeable certificate for the targeted properties below.
const tradeable = (): TokenCert => ({ ticker: "NVDA", trueGapPct: -2, perpGapPct: -0.1, classification: "MISPRICED", qualityGrade: "A", safetyScore: 90, policy: "LONG-ONLY FADE", evidence: [] });
const freshCert = () => issueCertificate(tradeable(), { anchorSource: "LAST_CLOSE", anchorStale: false, now: T0, ttlSec: 120 });

test("PROPERTY: an expired certificate is ALWAYS rejected", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), (extraMs) => {
      const cert = freshCert();
      const at = Date.parse(cert.payload.expiresAt) + extraMs;
      return verifyCertificate(cert, at).valid === false && evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd: 10, certificate: cert }, at).verdict === "REJECT";
    })
  );
});

test("PROPERTY: a ticker mismatch is ALWAYS rejected", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 6 }).filter((t) => t !== "NVDA"),
      (other) => evaluateIntent({ ticker: other, side: "buy", sizeUsd: 10, certificate: freshCert() }, T0 + 1000).verdict === "REJECT"
    )
  );
});

test("PROPERTY: the firewall never permits more than the certificate's max size", () => {
  fc.assert(
    fc.property(fc.double({ min: 0.01, max: 100_000, noNaN: true }), (sizeUsd) => {
      const cert = freshCert();
      const dec = evaluateIntent({ ticker: "NVDA", side: "buy", sizeUsd, certificate: cert }, T0 + 1000);
      if (dec.verdict === "REJECT") return true;
      const effective = dec.verdict === "ALLOW_CAPPED" ? dec.cappedSizeUsd! : sizeUsd;
      return effective <= cert.payload.maxSizeUsd + 1e-9;
    })
  );
});
