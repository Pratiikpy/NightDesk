// `npm run certify` — the keystone artifact: a signed, per-token certification of every Bitget
// tokenized stock. For each rToken it answers "is this market fair, mispriced, news-driven, an
// issuer risk, a liquidity trap, stale, or untradeable?", attaches a TRANSPARENT safety score
// (data-quality + tradeability — explicitly NOT an alpha/profit score), recommends an agent policy,
// and Ed25519-signs the whole report. This reframes NightDesk from "a bot" to "the safety & fair-
// value certification layer other agents can trust." Reuses the (tested) causality engine.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import pLimit from "p-limit";
import { collect } from "../pegwatch/collect";
import type { PegRow } from "../pegwatch/collect";
import { classifyGap, type GapType } from "../perception/causality";
import { MarketEventProvider, type PerceptionContext } from "../perception/events";
import { attest, type Attestation } from "../ledger/attest";

export type CertLabel = "FAIR" | "MISPRICED" | "NEWS-DRIVEN" | "MACRO-RISK" | "ISSUER-RISK" | "LIQUIDITY-TRAP" | "UNTRADEABLE" | "STALE";
export type CertPolicy = "NORMAL" | "LONG-ONLY FADE" | "WATCH" | "ABSTAIN" | "AVOID" | "BLOCK";

const LABEL: Record<GapType, CertLabel> = {
  NONE: "FAIR",
  NOISE: "MISPRICED",
  PERP_ILLUSION: "MISPRICED",
  NEWS: "NEWS-DRIVEN",
  EARNINGS: "NEWS-DRIVEN",
  MACRO: "MACRO-RISK",
  ISSUER: "ISSUER-RISK",
  LIQUIDITY_TRAP: "LIQUIDITY-TRAP",
  UNKNOWN: "STALE",
};

export interface TokenCert {
  ticker: string;
  trueGapPct: number | null;
  perpGapPct: number | null;
  classification: CertLabel;
  qualityGrade: string;
  safetyScore: number; // 0–100 TRANSPARENT data-quality + tradeability score (NOT alpha)
  policy: CertPolicy;
  evidence: string[];
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Pure: certify one token from its market row + perception context + (optional) quality grade. */
export function certifyToken(row: PegRow, perception: PerceptionContext, grade = "?"): TokenCert {
  const c = classifyGap(row, perception);
  const classification = LABEL[c.type];
  const trackingScore = grade === "A" ? 100 : grade === "B" ? 80 : grade === "C" ? 60 : grade === "D" ? 35 : 50;
  const liquidityScore = (row.rToken?.bookLevels ?? 0) > 0 ? 100 : row.rToken?.mid != null ? 60 : 15;
  const freshnessScore = row.equity?.marketState === "REGULAR" ? 100 : row.equity?.price != null ? 70 : 25;
  const eventSafetyScore = perception.news.fresh ? 40 : perception.macro.active ? 50 : 100;
  const executionScore = c.action === "FADE" ? 100 : c.action === "NONE" ? 90 : c.action === "ABSTAIN" ? 60 : c.action === "AVOID" ? 40 : 50;
  // Transparent weighted safety score — data quality + tradeability, NOT profitability.
  const safetyScore = clamp100(0.25 * trackingScore + 0.2 * liquidityScore + 0.15 * freshnessScore + 0.25 * eventSafetyScore + 0.15 * executionScore);

  let policy: CertPolicy;
  switch (classification) {
    case "FAIR":
      policy = "NORMAL";
      break;
    case "MISPRICED":
      policy = (c.trueGapPct ?? 0) < 0 ? "LONG-ONLY FADE" : "WATCH"; // rich rTokens aren't cleanly shortable
      break;
    case "NEWS-DRIVEN":
    case "MACRO-RISK":
    case "STALE":
      policy = "ABSTAIN";
      break;
    case "ISSUER-RISK":
      policy = "AVOID";
      break;
    default:
      policy = "BLOCK";
  }
  return { ticker: row.ticker, trueGapPct: c.trueGapPct, perpGapPct: c.perpGapPct, classification, qualityGrade: grade, safetyScore, policy, evidence: c.evidence };
}

function qualityGrades(): Map<string, string> {
  const file = join(process.cwd(), "data", "research", "token-quality.json");
  const m = new Map<string, string>();
  if (existsSync(file)) {
    try {
      for (const q of JSON.parse(readFileSync(file, "utf8")) as { ticker: string; grade: string }[]) m.set(q.ticker, q.grade);
    } catch {
      /* ignore */
    }
  }
  return m;
}

export interface CertReport {
  asOf: string;
  tokens: TokenCert[];
  summary: Record<string, number>;
  attestation: Attestation;
}

export async function runCertify(): Promise<CertReport> {
  const snap = await collect();
  const provider = new MarketEventProvider();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => provider.contextFor(r.ticker, snap.ts))));
  const grades = qualityGrades();
  const tokens = snap.rows.map((r, i) => certifyToken(r, ctxs[i]!, grades.get(r.ticker) ?? "?"));
  const summary: Record<string, number> = {};
  for (const t of tokens) summary[t.classification] = (summary[t.classification] ?? 0) + 1;
  const attestation = attest(tokens);
  return { asOf: snap.isoTime, tokens, summary, attestation };
}

export async function printCertify(): Promise<void> {
  const rep = await runCertify();
  console.log(`\nNightDesk — Market Certification Report @ ${rep.asOf}`);
  console.log("(per-token fairness/safety classification + agent policy. Safety = data-quality + tradeability, NOT alpha.)\n");
  console.log("TICKER  trueGap  classification   safety  grade  policy");
  console.log("------  -------  ---------------  ------  -----  ------");
  for (const t of [...rep.tokens].sort((a, b) => b.safetyScore - a.safetyScore)) {
    const tg = t.trueGapPct == null ? "   -   " : ((t.trueGapPct >= 0 ? "+" : "") + t.trueGapPct.toFixed(2) + "%").padStart(7);
    console.log(t.ticker.padEnd(6), tg, t.classification.padEnd(15), String(t.safetyScore).padStart(6), ("  " + t.qualityGrade).padEnd(5), t.policy);
  }
  console.log(`\nsummary: ${Object.entries(rep.summary).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  const fp = createHash("sha256").update(rep.attestation.publicKeyPem).digest("hex").slice(0, 16);
  const dir = join(process.cwd(), "data", "research");
  mkdirSync(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, `certification-${day}.json`), JSON.stringify(rep, null, 2));
  writeFileSync(join(dir, `certification-${day}.sig.json`), JSON.stringify(rep.attestation, null, 2));
  console.log(`\nsigned (Ed25519 pubkey#${fp}) → data/research/certification-${day}.json · verify by re-hashing the tokens + checking the signature against the embedded public key`);
}
