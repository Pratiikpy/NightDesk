// PegWatch fair-value math — PURE functions, unit-tested. No I/O here.
// PRD FR-3.1/3.3/3.6. Primary anchor = the real underlying stock (latest official NYSE print: live in
// market hours, last official close off-hours). The rToken<->perp basis is a secondary cross-check
// only and is used as a fallback when a replay predates the equity anchor — the perp is a blended
// issuer index that can hide the true gap, so it is never the headline anchor. These helpers are
// anchor-agnostic: `anchor` is supplied by the caller (equity anchor in production).

export interface Quote {
  bid: number | null;
  ask: number | null;
  last: number | null;
}

/** Mid price: prefer (bid+ask)/2 when both present & positive, else last. */
export function mid(q: Quote): number | null {
  if (q.bid != null && q.ask != null && q.bid > 0 && q.ask > 0) return (q.bid + q.ask) / 2;
  return q.last ?? null;
}

/** Percent premium of `price` over `anchor`. */
export function premiumPct(price: number, anchor: number): number {
  return ((price - anchor) / anchor) * 100;
}

/** Verified round-trip cost: spot 0.1%+0.1% + perp 0.06% taker ≈ 0.32% (verification-log V5). */
export const FEE_ROUND_TRIP_PCT = 0.32;

export type DepegState = "NORMAL" | "STRETCHED" | "DISLOCATED";

/** PRD FR-3.3 thresholds on |premium|. */
export function classifyDepeg(absPremiumPct: number): DepegState {
  if (absPremiumPct > 2) return "DISLOCATED";
  if (absPremiumPct >= 0.5) return "STRETCHED";
  return "NORMAL";
}

/** A premium below the round-trip fee floor is not tradeable as a basis trade. */
export function isTradeable(absPremiumPct: number, feeFloor = FEE_ROUND_TRIP_PCT): boolean {
  return absPremiumPct > feeFloor;
}

/**
 * sValue total-return adjustment for Ondo legs (PRD FR-3.6, verification-log V3).
 * Ondo price = underlying × sValue(multiplier). Divide to recover the underlying-equivalent,
 * so dividend reinvestment / splits are NOT misread as a depeg.
 * v0: multiplier defaults to 1.0 (hook scaffolded); real per-ticker multipliers come from the
 * Playbook dividend/split calendars in a later milestone. Documented limitation, never faked.
 */
export function sValueAdjust(ondoPrice: number, multiplier = 1.0): number {
  return ondoPrice / multiplier;
}

export interface TriLegs {
  rToken: number | null;
  perp: number | null;
  ondoAdj: number | null; // already sValue-adjusted
}
export interface TriResult {
  rPerpPct: number | null;
  ondoPerpPct: number | null;
  rOndoPct: number | null;
  maxDisagreementPct: number | null;
  flagged: boolean;
}

/** Three-price triangulation across rToken / Ondo(adj) / perp; flags disagreement > threshold. */
export function triangulate(legs: TriLegs, thresholdPct = 1.0): TriResult {
  const rPerpPct = legs.rToken != null && legs.perp != null ? premiumPct(legs.rToken, legs.perp) : null;
  const ondoPerpPct = legs.ondoAdj != null && legs.perp != null ? premiumPct(legs.ondoAdj, legs.perp) : null;
  const rOndoPct = legs.rToken != null && legs.ondoAdj != null ? premiumPct(legs.rToken, legs.ondoAdj) : null;
  const mags = [rPerpPct, ondoPerpPct, rOndoPct].filter((x): x is number => x != null).map(Math.abs);
  const maxDisagreementPct = mags.length ? Math.max(...mags) : null;
  return {
    rPerpPct,
    ondoPerpPct,
    rOndoPct,
    maxDisagreementPct,
    flagged: maxDisagreementPct != null && maxDisagreementPct > thresholdPct,
  };
}
