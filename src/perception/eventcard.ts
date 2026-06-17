// Perception — EventCard schema (PRD FR-2.4), the deterministic PegWatch-driven basis
// generator (no LLM), and the numeric-grounding rule (FR-2.5). Pure + unit-tested.
import type { Snapshot } from "../pegwatch/collect";
import { FEE_ROUND_TRIP_PCT } from "../pegwatch/fairvalue";

export type EventType = "earnings" | "macro" | "news" | "sentiment" | "basis";
export type DirectionHint = "long" | "short" | "neutral";

export interface EventCard {
  eventId: string;
  type: EventType;
  tickers: string[];
  directionHint: DirectionHint; // direction of the rToken trade
  magnitudeEst: number; // % (premium for basis; surprise for earnings)
  confidence: number; // 0..1
  halfLifeMin: number;
  sources: string[];
  ts: number;
  meta?: Record<string, unknown>;
}

/**
 * Generate dislocation EventCards from a PegWatch snapshot. We prefer the TRUE gap — the rToken vs
 * the real-stock anchor (`premiumVsEquityPct`/`stateVsEquity`) — which is the actual product thesis,
 * and fall back to the rToken↔perp basis only when the equity anchor is absent (e.g. legacy replays).
 * Only a tradeable, non-NORMAL gap produces a card. Direction: a negative gap (rToken cheaper than
 * fair value) → expect the rToken to converge UP → "long"; a positive gap → "short".
 */
export function basisEventCards(snap: Snapshot, feeFloor = FEE_ROUND_TRIP_PCT): EventCard[] {
  const cards: EventCard[] = [];
  for (const row of snap.rows) {
    const useEquity = row.premiumVsEquityPct != null;
    const gapPct = useEquity ? row.premiumVsEquityPct! : row.premiumPct;
    const gapState = useEquity ? row.stateVsEquity : row.state;
    if (gapPct == null || gapState == null || gapState === "NORMAL") continue;
    const mag = Math.abs(gapPct);
    if (mag <= feeFloor) continue; // not tradeable past the round-trip fee floor
    const gapKind: "equity" | "perp" = useEquity ? "equity" : "perp";
    const hasBook = (row.rToken?.bookLevels ?? 0) > 0;
    cards.push({
      eventId: `basis-${row.ticker}-${snap.ts}`,
      type: "basis",
      tickers: [row.ticker],
      directionHint: gapPct < 0 ? "long" : "short",
      magnitudeEst: mag,
      confidence: basisConfidence(mag, feeFloor, hasBook),
      halfLifeMin: 120,
      sources: [row.rToken?.symbol, row.perp?.symbol].filter((x): x is string => !!x),
      ts: snap.ts,
      meta: {
        gapPct,
        gapKind,
        depegState: gapState,
        premiumPct: row.premiumPct,
        premiumVsEquityPct: row.premiumVsEquityPct ?? null,
        hasBook,
        triangulationFlagged: row.triangulation?.flagged ?? false,
      },
    });
  }
  return cards;
}

/** Confidence scales with how far the premium exceeds the fee floor, +book presence. Bounded. */
export function basisConfidence(absPremiumPct: number, feeFloor: number, hasBook: boolean): number {
  const over = Math.max(0, absPremiumPct - feeFloor);
  let c = 0.5 + Math.min(0.4, over * 0.15);
  if (hasBook) c += 0.05;
  return Math.min(0.95, Number(c.toFixed(4)));
}

/** Numeric grounding (FR-2.5): an LLM-quoted number must match raw source within tolerance. */
export function groundNumber(quoted: number, source: number, tolPct = 1): boolean {
  if (source === 0) return quoted === 0;
  return (Math.abs(quoted - source) / Math.abs(source)) * 100 <= tolPct;
}

/** Merge cards from multiple providers, de-duplicating by eventId (first wins). */
export function dedupeCards(...lists: EventCard[][]): EventCard[] {
  const seen = new Map<string, EventCard>();
  for (const list of lists) for (const c of list) if (!seen.has(c.eventId)) seen.set(c.eventId, c);
  return [...seen.values()];
}
