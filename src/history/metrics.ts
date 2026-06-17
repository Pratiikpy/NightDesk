// Risk-adjusted metrics — the "credible evaluation stack" (Backtrader/TradingAgents pattern).
// Pure functions over a list of per-trade returns (in %, net of fees). We report these instead of
// leaning on win-rate, which the community correctly calls a weak headline.
import { mulberry32 } from "./study";

/** Mean of an array (0 if empty). */
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Population standard deviation. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** Sharpe over per-trade returns (excess over 0). Not annualised — a per-trade ratio. */
export function sharpe(returns: number[]): number {
  const sd = stdev(returns);
  return sd === 0 ? 0 : Number((mean(returns) / sd).toFixed(3));
}

/** Sortino: mean return over downside deviation (only negative returns penalised). */
export function sortino(returns: number[]): number {
  if (returns.length < 2) return 0;
  const downs = returns.filter((r) => r < 0);
  if (!downs.length) return returns.some((r) => r > 0) ? Infinity : 0;
  const dd = Math.sqrt(downs.reduce((a, b) => a + b * b, 0) / returns.length);
  return dd === 0 ? 0 : Number((mean(returns) / dd).toFixed(3));
}

/** Max drawdown (in the same units as the returns) of the cumulative-sum equity curve. */
export function maxDrawdown(returns: number[]): number {
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  for (const r of returns) {
    cum += r;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  return Number(maxDD.toFixed(3));
}

/** Profit factor = gross wins / gross losses. Infinity if no losses, 0 if no wins. */
export function profitFactor(returns: number[]): number {
  let win = 0;
  let loss = 0;
  for (const r of returns) {
    if (r > 0) win += r;
    else loss += -r;
  }
  if (loss === 0) return win > 0 ? Infinity : 0;
  return Number((win / loss).toFixed(3));
}

export interface RiskAdjusted {
  trades: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  profitFactor: number;
  avgReturnPct: number;
}

export function riskAdjusted(returns: number[]): RiskAdjusted {
  return {
    trades: returns.length,
    sharpe: sharpe(returns),
    sortino: sortino(returns),
    maxDrawdownPct: maxDrawdown(returns),
    profitFactor: profitFactor(returns),
    avgReturnPct: Number(mean(returns).toFixed(3)),
  };
}

// ── Probability calibration (are the agent's beliefs honest?) ─────────────────────────────────
// Brier score = mean squared error of probabilistic predictions (0 = perfect, 0.25 = always-50%,
// 1 = confidently wrong). Reliability buckets compare predicted probability to realized frequency.
// These prove the council's `p_converge` is calibrated against reality rather than vibes — and they
// only become meaningful once enough graded predictions accumulate (we always report n).

export interface Prediction {
  p: number; // predicted probability in [0,1]
  outcome: 0 | 1; // realized (1 = it happened)
}

export function brierScore(preds: Prediction[]): number {
  if (!preds.length) return 0;
  const s = preds.reduce((a, b) => a + (b.p - b.outcome) ** 2, 0) / preds.length;
  return Number(s.toFixed(4));
}

export interface ReliabilityBucket {
  lo: number;
  hi: number;
  n: number;
  predMean: number; // average predicted probability in the bucket
  actualRate: number; // realized frequency — should track predMean if calibrated
}

export function reliabilityBuckets(preds: Prediction[], nBuckets = 5): ReliabilityBucket[] {
  const buckets: ReliabilityBucket[] = [];
  for (let b = 0; b < nBuckets; b++) {
    const lo = b / nBuckets;
    const hi = (b + 1) / nBuckets;
    const inB = preds.filter((p) => p.p >= lo && (b === nBuckets - 1 ? p.p <= hi : p.p < hi));
    buckets.push({
      lo: Number(lo.toFixed(2)),
      hi: Number(hi.toFixed(2)),
      n: inB.length,
      predMean: inB.length ? Number(mean(inB.map((x) => x.p)).toFixed(3)) : 0,
      actualRate: inB.length ? Number(mean(inB.map((x) => x.outcome)).toFixed(3)) : 0,
    });
  }
  return buckets;
}


// ── Bootstrap confidence interval (the small-sample honesty answer) ────────────
// Resamples the per-observation values with replacement to bound the mean. Deterministic (seeded)
// so the reported CI is reproducible. Use it on per-trade PnLs / per-observation reversion returns:
// if the CI straddles 0, the "edge" is not distinguishable from noise — and we say so.

export interface MeanCI {
  n: number;
  mean: number;
  lo: number; // lower bound at (alpha/2)
  hi: number; // upper bound at (1-alpha/2)
  excludesZero: boolean; // true ⇒ the mean is distinguishable from 0 at this confidence
}

export function bootstrapMeanCI(samples: number[], iters = 2000, seed = 1234567, alpha = 0.05): MeanCI {
  const n = samples.length;
  if (n === 0) return { n: 0, mean: 0, lo: 0, hi: 0, excludesZero: false };
  const rng = mulberry32(seed);
  const means: number[] = [];
  for (let it = 0; it < iters; it++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += samples[Math.floor(rng() * n)]!;
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  const lo = means[Math.floor((alpha / 2) * iters)]!;
  const hi = means[Math.min(iters - 1, Math.floor((1 - alpha / 2) * iters))]!;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    mean: Number(mean.toFixed(4)),
    lo: Number(lo.toFixed(4)),
    hi: Number(hi.toFixed(4)),
    excludesZero: lo > 0 || hi < 0,
  };
}
