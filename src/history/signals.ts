// Phase-2 signal primitives — PURE, unit-tested. These are *candidate* signals; whether they
// actually improve the edge is measured honestly in run.ts against the random baseline. We keep a
// signal only if it earns its place.
import type { PremiumPoint } from "./study";

/** OLS slope b of premium_t on premium_{t-1} (the AR(1) persistence coefficient). */
export function ar1Coefficient(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    x.push(xs[i - 1]);
    y.push(xs[i]);
  }
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  if (sxx === 0) return null;
  return sxy / sxx;
}

/**
 * Ornstein-Uhlenbeck half-life of the premium series, in bars. A small half-life = the gap reverts
 * fast (good for convergence trading). Returns Infinity when the series is not cleanly mean-reverting
 * (AR(1) coefficient not in (0,1)) — i.e., not a fast-reverting candidate.
 */
export function halfLifeBars(series: PremiumPoint[]): number {
  const b = ar1Coefficient(series.map((s) => s.premiumPct));
  if (b == null || b <= 0 || b >= 1) return Infinity;
  return -Math.log(2) / Math.log(b);
}

/** Median of finite numbers (ignores Infinity/NaN). 0 if none. */
export function median(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Align many pairs' premium series into ts → {ticker → premium} cross-sections. */
export function alignCrossSection(byTicker: Map<string, PremiumPoint[]>): Map<number, Map<string, number>> {
  const out = new Map<number, Map<string, number>>();
  for (const [ticker, series] of byTicker) {
    for (const pt of series) {
      let row = out.get(pt.ts);
      if (!row) {
        row = new Map();
        out.set(pt.ts, row);
      }
      row.set(ticker, pt.premiumPct);
    }
  }
  return out;
}

/**
 * Basket co-depeg stress at one timestamp = mean |premium| across the tickers present.
 * High stress = many tokens dislocated together (a liquidity event, hypothesised to revert harder);
 * low stress = an isolated, idiosyncratic dislocation.
 */
export function crossSectionalStress(row: Map<string, number>): number {
  if (!row || row.size === 0) return 0;
  let s = 0;
  for (const v of row.values()) s += Math.abs(v);
  return s / row.size;
}

/**
 * CAUSAL trailing z-score of the premium at bar i — uses ONLY bars [i-window+1 .. i]. A live signal
 * must be causal (no peeking at the future); this is the function the look-ahead sentinel test guards.
 * Returns null until there is a full window of history.
 */
export function premiumZScoreCausal(prems: number[], i: number, window: number): number | null {
  if (window < 2 || i < window - 1 || i >= prems.length) return null;
  const w = prems.slice(i - window + 1, i + 1);
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const variance = w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (prems[i] - mean) / sd;
}
