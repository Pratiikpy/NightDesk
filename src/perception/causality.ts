// Gap Causality Engine — classify WHY a dislocation exists, from signals we already collect.
// This turns binary "abstain?" into typed intelligence: the desk says not just *whether* to act but
// *why* the gap is there (noise / news / earnings / macro / issuer / perp-illusion / liquidity-trap)
// and the resulting action. Pure + deterministic — every label traces to concrete evidence, and the
// `confidence` is a transparent rule-based salience (NOT a probability claim).
import type { PegRow } from "../pegwatch/collect";
import type { PerceptionContext } from "./events";

export type GapType =
  | "NONE" // no actionable gap vs the real stock
  | "NEWS" // fresh company catalyst → gap may be real
  | "EARNINGS" // earnings/guidance catalyst
  | "MACRO" // high-severity macro day (FOMC/CPI/PCE)
  | "ISSUER" // rToken/Ondo/perp disagree → venue/issuer-specific
  | "PERP_ILLUSION" // perp hides the gap; only the real-stock anchor sees it (the core discovery)
  | "NOISE" // off-hours drift, no catalyst → fade candidate
  | "LIQUIDITY_TRAP" // no tradeable quote
  | "UNKNOWN"; // no real-stock anchor → can't judge

export type GapAction = "FADE" | "ABSTAIN" | "AVOID" | "NONE";

export interface GapClassification {
  ticker: string;
  type: GapType;
  action: GapAction;
  trueGapPct: number | null; // rToken vs the real-stock anchor (session-aware NYSE print)
  perpGapPct: number | null; // rToken vs perp (the index that hides it)
  confidence: number; // transparent rule-based salience in [0,1], NOT a probability
  evidence: string[];
  note: string;
}

export interface GapOptions {
  stretchPct?: number; // |true gap| below this = no actionable gap
  perpIllusionPct?: number; // |perp gap| below this (with a real true gap) = perp illusion
}

export function classifyGap(row: PegRow, perception: PerceptionContext, opts: GapOptions = {}): GapClassification {
  const stretch = opts.stretchPct ?? 0.5;
  const perpIllusion = opts.perpIllusionPct ?? 0.5;
  const trueGap = row.premiumVsEquityPct ?? null;
  const perpGap = row.premiumPct ?? null;
  const base = { ticker: row.ticker, trueGapPct: trueGap, perpGapPct: perpGap };
  const ev: string[] = [];

  if (trueGap == null) {
    return { ...base, type: "UNKNOWN", action: "ABSTAIN", confidence: 0.3, evidence: ["no real-stock anchor available"], note: "cannot judge without the NYSE anchor" };
  }
  const absTrue = Math.abs(trueGap);
  if (row.stateVsEquity === "NORMAL" || absTrue < stretch) {
    return { ...base, type: "NONE", action: "NONE", confidence: 0.2, evidence: [`true gap ${trueGap.toFixed(2)}% within normal`], note: "no actionable gap vs the real stock" };
  }

  const liquidity = (row.rToken?.bookLevels ?? 0) > 0 ? "L2" : row.rToken?.mid != null ? "quote-only" : "none";
  if (liquidity === "none") {
    return { ...base, type: "LIQUIDITY_TRAP", action: "AVOID", confidence: 0.7, evidence: ["no tradeable rToken quote"], note: "untradeable — no quote" };
  }

  // News / earnings (the gap may be REAL → abstain)
  if (perception.news.fresh) {
    const earnings = perception.news.matched.some((t) => /earnings|guidance|beat|miss/i.test(t));
    ev.push(`news: ${perception.news.summary}`);
    return {
      ...base,
      type: earnings ? "EARNINGS" : "NEWS",
      action: "ABSTAIN",
      confidence: 0.8,
      evidence: ev,
      note: earnings ? "earnings/guidance catalyst — gap likely real, don't fade" : "company catalyst — gap likely real, don't fade",
    };
  }

  // Macro window
  if (perception.macro.active) {
    ev.push(`macro: ${perception.macro.summary}`);
    return { ...base, type: "MACRO", action: "ABSTAIN", confidence: 0.75, evidence: ev, note: "high-severity macro day — repricing risk, stand down" };
  }

  // Issuer/venue: the three legs disagree
  if (row.triangulation?.flagged) {
    ev.push("rToken / Ondo / perp disagree > threshold");
    return { ...base, type: "ISSUER", action: "AVOID", confidence: 0.6, evidence: ev, note: "venue/issuer-specific divergence — not a clean basis" };
  }

  // Perp illusion: the true gap is real but the perp barely shows it (the core discovery)
  if (perpGap != null && Math.abs(perpGap) < perpIllusion) {
    ev.push(`perp hides it: vs-perp ${perpGap.toFixed(2)}% vs vs-NYSE ${trueGap.toFixed(2)}%`);
    if (liquidity !== "L2") ev.push("rToken quote-only (thin)");
    return {
      ...base,
      type: "PERP_ILLUSION",
      action: "FADE",
      confidence: Math.min(0.7, 0.4 + absTrue * 0.1),
      evidence: ev,
      note: "perp (a composite of the same tokens) masks the gap; only the real-stock anchor sees it",
    };
  }

  // Otherwise: off-hours drift with no catalyst → fade candidate
  ev.push(`off-hours drift, no catalyst (vs-NYSE ${trueGap.toFixed(2)}%, liquidity ${liquidity})`);
  return { ...base, type: "NOISE", action: "FADE", confidence: Math.min(0.65, 0.35 + absTrue * 0.1), evidence: ev, note: "quiet dislocation — fade candidate" };
}
