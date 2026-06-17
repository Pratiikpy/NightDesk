// Risk-adjusted performance statistics — PURE functions, unit-tested, no I/O.
// Trader-judges expect Sharpe/Sortino/Calmar/profit-factor/expectancy, not just raw PnL. These all
// operate on plain numeric series so they can be applied to per-session returns or per-trade PnL.
//
// Honesty rule: a ratio computed on a handful of samples is noise. `summarizePerformance` therefore
// always reports `n` and a `reliable` flag (false below MIN_RELIABLE_N) so the evidence never presents
// Sharpe-on-5-trades as if it were gospel. Ratios are reported PER-PERIOD (per session/trade) and are
// NOT annualized — annualizing an irregular, short series invents precision we do not have.

export const MIN_RELIABLE_N = 10;

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Sample standard deviation (n-1). Returns 0 for fewer than 2 points. */
export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Per-period Sharpe = (mean excess return) / (stddev of returns). 0 if undefined. */
export function sharpe(returns: number[], riskFree = 0): number {
  const sd = stddev(returns);
  if (sd === 0) return 0;
  return (mean(returns) - riskFree) / sd;
}

/** Downside deviation: RMS of returns below the target (default 0). */
export function downsideDeviation(returns: number[], target = 0): number {
  if (returns.length < 1) return 0;
  const downside = returns.map((r) => Math.min(0, r - target) ** 2);
  return Math.sqrt(downside.reduce((a, b) => a + b, 0) / returns.length);
}

/** Per-period Sortino = (mean excess return) / (downside deviation). 0 if no downside. */
export function sortino(returns: number[], riskFree = 0): number {
  const dd = downsideDeviation(returns, riskFree);
  if (dd === 0) return 0;
  return (mean(returns) - riskFree) / dd;
}

/** Max drawdown of an equity curve, as a POSITIVE fraction of the running peak (0..1). */
export function maxDrawdown(equityCurve: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  return maxDd;
}

/** Build a cumulative equity curve from a starting balance and a series of per-period PnL amounts. */
export function equityCurve(startBalance: number, pnls: number[]): number[] {
  const curve: number[] = [startBalance];
  let bal = startBalance;
  for (const p of pnls) {
    bal += p;
    curve.push(bal);
  }
  return curve;
}

/** Profit factor = gross profit / gross loss. Infinity if there are wins and no losses; 0 if neither. */
export function profitFactor(pnls: number[]): number {
  const grossProfit = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = -pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0);
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

/** Expectancy = average PnL per trade. */
export function expectancy(pnls: number[]): number {
  return mean(pnls);
}

/** Win rate over trades that actually moved PnL (ignores exact-zero scratches). */
export function winRate(pnls: number[]): number {
  const decided = pnls.filter((p) => p !== 0);
  if (!decided.length) return 0;
  return decided.filter((p) => p > 0).length / decided.length;
}

/** Calmar = total return fraction / max drawdown fraction. 0 if no drawdown. */
export function calmar(totalReturnFraction: number, maxDdFraction: number): number {
  if (maxDdFraction === 0) return 0;
  return totalReturnFraction / maxDdFraction;
}

export interface PerformanceSummary {
  n: number;
  reliable: boolean;
  reliabilityNote: string;
  totalPnl: number;
  totalReturnPct: number;
  meanReturnPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdownPct: number;
  profitFactor: number | null; // null encodes Infinity for clean JSON
  expectancy: number;
  winRatePct: number;
  wins: number;
  losses: number;
}

/**
 * Summarize a paper-trading record. `pnls` are per-period PnL amounts (e.g. per session or per trade)
 * in account currency; `startBalance` anchors the equity curve and converts to returns.
 */
export function summarizePerformance(pnls: number[], startBalance = 1000): PerformanceSummary {
  const n = pnls.length;
  const returns = pnls.map((p) => p / startBalance); // per-period fractional returns
  const curve = equityCurve(startBalance, pnls);
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const maxDd = maxDrawdown(curve);
  const totalReturnFraction = startBalance > 0 ? totalPnl / startBalance : 0;
  const pf = profitFactor(pnls);
  const reliable = n >= MIN_RELIABLE_N;
  return {
    n,
    reliable,
    reliabilityNote: reliable
      ? `n=${n} observations — ratios are interpretable.`
      : `n=${n} < ${MIN_RELIABLE_N}: ratios are reported but NOT yet statistically reliable (too few observations). They strengthen as the forward record grows.`,
    totalPnl: Number(totalPnl.toFixed(6)),
    totalReturnPct: Number((totalReturnFraction * 100).toFixed(4)),
    meanReturnPct: Number((mean(returns) * 100).toFixed(4)),
    sharpe: Number(sharpe(returns).toFixed(4)),
    sortino: Number(sortino(returns).toFixed(4)),
    calmar: Number(calmar(totalReturnFraction, maxDd).toFixed(4)),
    maxDrawdownPct: Number((maxDd * 100).toFixed(4)),
    profitFactor: pf === Infinity ? null : Number(pf.toFixed(4)),
    expectancy: Number(expectancy(pnls).toFixed(6)),
    winRatePct: Number((winRate(pnls) * 100).toFixed(2)),
    wins: pnls.filter((p) => p > 0).length,
    losses: pnls.filter((p) => p < 0).length,
  };
}
