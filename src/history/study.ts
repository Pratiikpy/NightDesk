// Historical evidence studies — PURE functions, unit-tested. Operate on a premium series
// (rToken close vs perp close). No execution assumption in B/C; A is a premium-space basis
// PnL that explicitly nets fees (and is caveated since rToken candles are mark-priced, vol=0).

export interface Bar {
  ts: number;
  close: number;
}
export interface PremiumPoint {
  ts: number;
  rClose: number;
  perpClose: number;
  premiumPct: number;
}

/** Align rToken + perp bars by timestamp into a premium series (premium = (rToken-perp)/perp). */
export function buildPremiumSeries(rBars: Bar[], perpBars: Bar[]): PremiumPoint[] {
  const perpByTs = new Map(perpBars.map((b) => [b.ts, b.close]));
  const out: PremiumPoint[] = [];
  for (const rb of rBars) {
    const pc = perpByTs.get(rb.ts);
    if (pc != null && pc > 0 && rb.close > 0) {
      out.push({ ts: rb.ts, rClose: rb.close, perpClose: pc, premiumPct: ((rb.close - pc) / pc) * 100 });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// ── C. Convergence capture rate ───────────────────────────────────────────────
// Of all points where |premium| ≥ stretch, what fraction had a SMALLER |premium| `horizon` bars later?
export interface CaptureResult {
  events: number;
  captured: number;
  ratePct: number;
  avgNarrowingPct: number; // average reduction in |premium| across events
}
export function convergenceCapture(series: PremiumPoint[], stretchPct: number, horizon: number): CaptureResult {
  let events = 0;
  let captured = 0;
  let narrowingSum = 0;
  for (let i = 0; i + horizon < series.length; i++) {
    const p0 = Math.abs(series[i].premiumPct);
    if (p0 >= stretchPct) {
      events++;
      const pH = Math.abs(series[i + horizon].premiumPct);
      if (pH < p0) captured++;
      narrowingSum += p0 - pH;
    }
  }
  return {
    events,
    captured,
    ratePct: events ? Number(((captured / events) * 100).toFixed(1)) : 0,
    avgNarrowingPct: events ? Number((narrowingSum / events).toFixed(4)) : 0,
  };
}

// ── B. Peg-tracking error ─────────────────────────────────────────────────────
// Does the perp anchor predict the rToken's future close better than its own last close?
// model prediction = perp(t); baseline (persistence) = rToken(t); target = rToken(t+horizon).
export interface TrackingResult {
  n: number;
  modelMAE: number;
  baselineMAE: number;
  improvementPct: number; // >0 means the perp anchor adds information
}
export function pegTrackingError(series: PremiumPoint[], horizon: number): TrackingResult {
  let modelErr = 0;
  let baseErr = 0;
  let n = 0;
  for (let i = 0; i + horizon < series.length; i++) {
    const future = series[i + horizon].rClose;
    modelErr += Math.abs(series[i].perpClose - future);
    baseErr += Math.abs(series[i].rClose - future);
    n++;
  }
  if (!n) return { n: 0, modelMAE: 0, baselineMAE: 0, improvementPct: 0 };
  const modelMAE = modelErr / n;
  const baselineMAE = baseErr / n;
  return {
    n,
    modelMAE: Number(modelMAE.toFixed(4)),
    baselineMAE: Number(baselineMAE.toFixed(4)),
    improvementPct: baselineMAE ? Number(((1 - modelMAE / baselineMAE) * 100).toFixed(2)) : 0,
  };
}

// ── A. Basis convergence backtest (premium-space, fee-netted) — SURVIVORSHIP-FREE ─────────────
// Enter long-basis (long rToken / short perp) when premium ≤ -entry; close on convergence
// (premium ≥ -exit). Symmetric short-basis when premium ≥ +entry (close on premium ≤ +exit).
// CRITICAL HONESTY FIX: a position that never converges is NOT silently dropped. It is force-closed
// at a time-stop (`maxHoldBars`) or at the end of the series, marked to that bar's premium, and
// counted as the (usually losing) trade it is. The pre-fix version only closed on convergence, which
// dropped every non-converging position and produced a fake ~100% win rate. `forcedExits` exposes
// how many trades had to be marked out rather than converging on their own.
export interface BasisResult {
  trades: number;
  wins: number;
  losses: number;
  forcedExits: number; // closed by time-stop / end-of-series, not by natural convergence
  winRatePct: number;
  totalPnlPct: number; // sum of net premium-points captured (or lost)
  avgPnlPct: number;
  avgHoldBars: number;
  pnls: number[]; // per-trade net PnL (pp) — feeds risk-adjusted metrics
}
export function basisBacktest(
  series: PremiumPoint[],
  entryPct: number,
  exitPct: number,
  roundTripFeePct: number,
  maxHoldBars = Infinity
): BasisResult {
  let pos: { side: "long_basis" | "short_basis"; entryPremium: number; entryIdx: number } | null = null;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let forcedExits = 0;
  let totalPnlPct = 0;
  let holdSum = 0;
  const pnls: number[] = [];

  const close = (prem: number, i: number, forced: boolean) => {
    const gross = pos!.side === "long_basis" ? prem - pos!.entryPremium : pos!.entryPremium - prem;
    const net = gross - roundTripFeePct;
    trades++;
    if (net > 0) wins++;
    else losses++;
    if (forced) forcedExits++;
    totalPnlPct += net;
    holdSum += i - pos!.entryIdx;
    pnls.push(Number(net.toFixed(4)));
    pos = null;
  };

  for (let i = 0; i < series.length; i++) {
    const prem = series[i].premiumPct;
    if (!pos) {
      if (prem <= -entryPct) pos = { side: "long_basis", entryPremium: prem, entryIdx: i };
      else if (prem >= entryPct) pos = { side: "short_basis", entryPremium: prem, entryIdx: i };
    } else {
      const converged = pos.side === "long_basis" ? prem >= -exitPct : prem <= exitPct;
      if (converged) close(prem, i, false);
      else if (i - pos.entryIdx >= maxHoldBars) close(prem, i, true); // time-stop: count the loser
    }
  }
  if (pos) close(series[series.length - 1].premiumPct, series.length - 1, true); // mark-to-end

  return {
    trades,
    wins,
    losses,
    forcedExits,
    winRatePct: trades ? Number(((wins / trades) * 100).toFixed(1)) : 0,
    totalPnlPct: Number(totalPnlPct.toFixed(3)),
    avgPnlPct: trades ? Number((totalPnlPct / trades).toFixed(3)) : 0,
    avgHoldBars: trades ? Number((holdSum / trades).toFixed(1)) : 0,
    pnls,
  };
}

// ── CLAIRVOYANT UPPER BOUND (perfect-hindsight frontier) ──────────────────────────────────────
// The honest way to frame a thin edge: how much of the TOTAL extractable convergence did we capture?
// A clairvoyant trader sees the future — at each stretched bar it picks the single best exit within
// the hold window (max gap-closure), takes it only if positive net of fees, and never overlaps.
// That sum is the theoretical maximum any convergence strategy could extract on this series. We then
// report NightDesk's real basis PnL as a FRACTION of that bound. (Explicitly hindsight — an upper
// bound, never presented as achievable.)
export interface ClairvoyantBound {
  opportunities: number;
  maxPnlPct: number; // best non-overlapping convergence capture, net of fees, with perfect timing
}
export function clairvoyantBound(series: PremiumPoint[], entryPct: number, feePct: number, maxHoldBars: number): ClairvoyantBound {
  let i = 0;
  let opportunities = 0;
  let maxPnlPct = 0;
  while (i < series.length) {
    const p0 = Math.abs(series[i]!.premiumPct);
    if (p0 < entryPct) {
      i++;
      continue;
    }
    const end = Math.min(series.length - 1, i + maxHoldBars);
    let bestNet = 0;
    let bestJ = -1;
    for (let j = i + 1; j <= end; j++) {
      const net = p0 - Math.abs(series[j]!.premiumPct) - feePct; // gap-closure captured, net fee
      if (net > bestNet) {
        bestNet = net;
        bestJ = j;
      }
    }
    if (bestJ >= 0 && bestNet > 0) {
      opportunities++;
      maxPnlPct += bestNet;
      i = bestJ + 1; // non-overlapping
    } else {
      i++;
    }
  }
  return { opportunities, maxPnlPct: Number(maxPnlPct.toFixed(3)) };
}

// ── HONESTY CONTROLS: random-entry baseline + shuffle test ────────────────────────────────────
// The point of these is to answer the one question a quant judge asks: "is your 93% convergence
// capture / positive basis PnL a real edge, or just a noisy mean-reverting series doing what noisy
// mean-reverting series always do?" If the real (stretch-conditioned) numbers do NOT clear these
// controls by a wide, stable margin, we say so — honestly.

/** Deterministic RNG (mulberry32) so every baseline is reproducible and runs network-free. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RandomBaseline {
  iters: number;
  capHits: number; // raw counts so callers can pool across pairs honestly
  capTotal: number;
  captureRatePct: number; // unconditional P(|premium| smaller after horizon) at RANDOM points
  basisPnlPct: number; // avg total basis PnL per iteration, random entries, net of fees
  basisTrades: number; // avg trades per iteration
}

/**
 * Random-entry baseline. Picks entries WITHOUT the stretch condition — random bars, random side,
 * matched in count to the real strategy — and measures capture + basis PnL under the SAME exit /
 * time-stop / fee rules. Edge-over-random = real minus this.
 */
export function randomBaseline(
  series: PremiumPoint[],
  horizon: number,
  exitPct: number,
  roundTripFeePct: number,
  realEntryCount: number,
  maxHoldBars: number,
  iters = 200,
  seed = 12345
): RandomBaseline {
  if (series.length < horizon + 2 || realEntryCount <= 0) {
    return { iters: 0, capHits: 0, capTotal: 0, captureRatePct: 0, basisPnlPct: 0, basisTrades: 0 };
  }
  const rng = mulberry32(seed);
  let capHits = 0;
  let capTotal = 0;
  let pnlSum = 0;
  let tradeSum = 0;
  const entryProb = Math.min(1, realEntryCount / series.length);

  for (let it = 0; it < iters; it++) {
    // capture control: realEntryCount random points, measure narrowing after `horizon`
    for (let k = 0; k < realEntryCount; k++) {
      const i = Math.floor(rng() * (series.length - horizon));
      if (Math.abs(series[i + horizon].premiumPct) < Math.abs(series[i].premiumPct)) capHits++;
      capTotal++;
    }
    // PnL control: random entries (random side) with the same exit / time-stop / fee rules
    let trades = 0;
    let pnl = 0;
    let entriesLeft = realEntryCount;
    let pos: { side: "long_basis" | "short_basis"; entryPremium: number; entryIdx: number } | null = null;
    for (let i = 0; i < series.length && (entriesLeft > 0 || pos); i++) {
      const prem = series[i].premiumPct;
      if (!pos && entriesLeft > 0 && rng() < entryProb) {
        pos = { side: rng() < 0.5 ? "long_basis" : "short_basis", entryPremium: prem, entryIdx: i };
        entriesLeft--;
      } else if (pos) {
        const converged = pos.side === "long_basis" ? prem >= -exitPct : prem <= exitPct;
        if (converged || i - pos.entryIdx >= maxHoldBars) {
          const gross = pos.side === "long_basis" ? prem - pos.entryPremium : pos.entryPremium - prem;
          pnl += gross - roundTripFeePct;
          trades++;
          pos = null;
        }
      }
    }
    if (pos) {
      const prem = series[series.length - 1].premiumPct;
      const gross = pos.side === "long_basis" ? prem - pos.entryPremium : pos.entryPremium - prem;
      pnl += gross - roundTripFeePct;
      trades++;
    }
    pnlSum += pnl;
    tradeSum += trades;
  }
  return {
    iters,
    capHits,
    capTotal,
    captureRatePct: capTotal ? Number(((capHits / capTotal) * 100).toFixed(1)) : 0,
    basisPnlPct: Number((pnlSum / iters).toFixed(3)),
    basisTrades: Number((tradeSum / iters).toFixed(1)),
  };
}

/**
 * Shuffle test. Destroys time-ordering (autocorrelation) by permuting the premium values, then
 * re-measures convergence capture. If the real capture rate is mostly temporal mean-reversion, the
 * shuffled rate collapses toward the unconditional base rate; if real ≈ shuffled, the "capture"
 * metric is a distribution artifact, not a tradeable temporal edge. Returns capHits/capTotal so
 * callers can pool across pairs.
 */
export interface ShuffleResult {
  capHits: number;
  capTotal: number;
  ratePct: number;
}
export function convergenceCaptureShuffled(
  series: PremiumPoint[],
  stretchPct: number,
  horizon: number,
  iters = 50,
  seed = 999
): ShuffleResult {
  if (series.length < horizon + 2) return { capHits: 0, capTotal: 0, ratePct: 0 };
  const rng = mulberry32(seed);
  const base = series.map((s) => s.premiumPct);
  let capHits = 0;
  let capTotal = 0;
  for (let it = 0; it < iters; it++) {
    const sh = base.slice();
    for (let i = sh.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [sh[i], sh[j]] = [sh[j], sh[i]];
    }
    for (let i = 0; i + horizon < sh.length; i++) {
      const p0 = Math.abs(sh[i]);
      if (p0 >= stretchPct) {
        capTotal++;
        if (Math.abs(sh[i + horizon]) < p0) capHits++;
      }
    }
  }
  return { capHits, capTotal, ratePct: capTotal ? Number(((capHits / capTotal) * 100).toFixed(1)) : 0 };
}


// ── K. True-gap reversion (the open-horizon edge test) ─────────────────────────
// THE core thesis, tested directly + look-ahead-safe: when an rToken is dislocated from the LAST
// real close (the anchor known at decision time), does it move back toward fair value next session?
// We anchor each day on the PRIOR aligned real close (eq_{t-1}) — never a future price — and measure
// the rToken's next-day return. reversionReturnPct = mean(ret · −sign(gap)): positive ⇒ cheap rTokens
// rise and rich rTokens fall (the fade edge); compare to the baseline noise floor on non-dislocated
// days. Honest caveat: a daily test cannot tell noise-reversion from a genuine overnight repricing
// (news) — that is exactly what the live abstention layer filters out.
export interface GapReversionResult {
  n: number; // dislocation observations (|gap| ≥ stretch)
  reversionReturnPct: number; // mean next-day rToken return in the gap-closing direction (+ = reverts)
  correctiveRatePct: number; // % of dislocations where the rToken moved toward fair value
  cheapNextRetPct: number; // mean next-day rToken return when cheap (gap < −stretch); expect +
  richNextRetPct: number; // mean next-day rToken return when rich (gap > +stretch); expect −
  baselineAbsRetPct: number; // mean |next-day return| on non-dislocated days (the noise floor)
}

const dayKeyR = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

export function trueGapReversion(rBars: Bar[], eqBars: Bar[], stretchPct = 1): GapReversionResult {
  const eqByDay = new Map<string, number>();
  for (const b of eqBars) if (b.close > 0) eqByDay.set(dayKeyR(b.ts), b.close);
  const rows: { day: string; r: number; eq: number }[] = [];
  for (const b of rBars) {
    if (b.close <= 0) continue;
    const eq = eqByDay.get(dayKeyR(b.ts));
    if (eq != null && eq > 0) rows.push({ day: dayKeyR(b.ts), r: b.close, eq });
  }
  rows.sort((a, b) => (a.day < b.day ? -1 : 1));

  let n = 0;
  let revSum = 0;
  let corrective = 0;
  let cheapN = 0;
  let cheapSum = 0;
  let richN = 0;
  let richSum = 0;
  let baseN = 0;
  let baseAbsSum = 0;
  for (let i = 1; i < rows.length - 1; i++) {
    const anchor = rows[i - 1]!.eq; // prior REAL close — known at time i, no look-ahead
    const gap = (rows[i]!.r - anchor) / anchor;
    const ret = (rows[i + 1]!.r - rows[i]!.r) / rows[i]!.r; // next-day rToken return
    if (Math.abs(gap) * 100 < stretchPct) {
      baseN++;
      baseAbsSum += Math.abs(ret);
      continue;
    }
    n++;
    const reversion = ret * -Math.sign(gap); // + if the rToken moved toward fair value
    revSum += reversion;
    if (reversion > 0) corrective++;
    if (gap < 0) {
      cheapN++;
      cheapSum += ret;
    } else {
      richN++;
      richSum += ret;
    }
  }
  return {
    n,
    reversionReturnPct: n ? Number(((revSum / n) * 100).toFixed(3)) : 0,
    correctiveRatePct: n ? Number(((corrective / n) * 100).toFixed(1)) : 0,
    cheapNextRetPct: cheapN ? Number(((cheapSum / cheapN) * 100).toFixed(3)) : 0,
    richNextRetPct: richN ? Number(((richSum / richN) * 100).toFixed(3)) : 0,
    baselineAbsRetPct: baseN ? Number(((baseAbsSum / baseN) * 100).toFixed(3)) : 0,
  };
}

// Regime discovery: does the (null-overall) reversion survive in any GAP-SIZE bucket? "Do only
// extreme dislocations revert?" Same look-ahead-safe construction, sliced by |gap|.
export interface ReversionBucket {
  label: string;
  n: number;
  corrective: number; // raw count (so callers can pool exactly across pairs)
  reversionSumPct: number; // raw sum of per-obs reversion% (poolable)
  correctiveRatePct: number;
  reversionReturnPct: number;
}

export function gapReversionBuckets(rBars: Bar[], eqBars: Bar[]): ReversionBucket[] {
  const eqByDay = new Map<string, number>();
  for (const b of eqBars) if (b.close > 0) eqByDay.set(dayKeyR(b.ts), b.close);
  const rows: { day: string; r: number; eq: number }[] = [];
  for (const b of rBars) {
    if (b.close <= 0) continue;
    const eq = eqByDay.get(dayKeyR(b.ts));
    if (eq != null && eq > 0) rows.push({ day: dayKeyR(b.ts), r: b.close, eq });
  }
  rows.sort((a, b) => (a.day < b.day ? -1 : 1));
  const defs: [string, number, number][] = [
    ["0.5-1%", 0.5, 1],
    ["1-2%", 1, 2],
    ["2-4%", 2, 4],
    ["4%+", 4, Infinity],
  ];
  const agg = defs.map(([label, lo, hi]) => ({ label, lo, hi, n: 0, corrective: 0, revSum: 0 }));
  for (let i = 1; i < rows.length - 1; i++) {
    const anchor = rows[i - 1]!.eq;
    const gap = (rows[i]!.r - anchor) / anchor;
    const ag = Math.abs(gap) * 100;
    if (ag < 0.5) continue;
    const ret = (rows[i + 1]!.r - rows[i]!.r) / rows[i]!.r;
    const reversion = ret * -Math.sign(gap) * 100;
    const b = agg.find((x) => ag >= x.lo && ag < x.hi);
    if (!b) continue;
    b.n++;
    b.revSum += reversion;
    if (reversion > 0) b.corrective++;
  }
  return agg.map((b) => ({
    label: b.label,
    n: b.n,
    corrective: b.corrective,
    reversionSumPct: Number(b.revSum.toFixed(4)),
    correctiveRatePct: b.n ? Number(((b.corrective / b.n) * 100).toFixed(1)) : 0,
    reversionReturnPct: b.n ? Number((b.revSum / b.n).toFixed(3)) : 0,
  }));
}
