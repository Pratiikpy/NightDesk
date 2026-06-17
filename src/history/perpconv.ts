// Perp-leg convergence study (the council's kill-shot fix). Inverts the roles:
//   - the rToken (broker-routed, tracks the real underlying equity even at zero crypto volume)
//     is treated as the FAIR-VALUE oracle;
//   - the PERP (the genuinely liquid, real-volume instrument) is what we actually trade,
//     toward that fair value.
// This makes the edge executable on the only leg with real fills — answering "the rToken is
// untradeable so the basis PnL is illustrative." Pure functions, unit-tested.

export interface PerpPoint {
  ts: number;
  perpClose: number;
  fairValue: number; // rToken close = broker-routed fair-value oracle
  deviationPct: number; // (perp - fair) / fair
}

/** Build the perp-vs-fairvalue series. rBars = fair-value oracle (rToken), perpBars = tradeable. */
export function buildPerpSeries(perpBars: { ts: number; close: number }[], rBars: { ts: number; close: number }[]): PerpPoint[] {
  const fairByTs = new Map(rBars.map((b) => [b.ts, b.close]));
  const out: PerpPoint[] = [];
  for (const pb of perpBars) {
    const fv = fairByTs.get(pb.ts);
    if (fv != null && fv > 0 && pb.close > 0) {
      out.push({ ts: pb.ts, perpClose: pb.close, fairValue: fv, deviationPct: ((pb.close - fv) / fv) * 100 });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

export interface PerpConvResult {
  events: number;
  captured: number;
  ratePct: number;
  avgNarrowingPct: number;
}
/** When the perp deviates from fair value beyond `stretch`, does |deviation| shrink within horizon? */
export function perpConvergence(series: PerpPoint[], stretchPct: number, horizon: number): PerpConvResult {
  let events = 0;
  let captured = 0;
  let narrowing = 0;
  for (let i = 0; i + horizon < series.length; i++) {
    const d0 = Math.abs(series[i].deviationPct);
    if (d0 >= stretchPct) {
      events++;
      const dH = Math.abs(series[i + horizon].deviationPct);
      if (dH < d0) captured++;
      narrowing += d0 - dH;
    }
  }
  return {
    events,
    captured,
    ratePct: events ? Number(((captured / events) * 100).toFixed(1)) : 0,
    avgNarrowingPct: events ? Number((narrowing / events).toFixed(4)) : 0,
  };
}

export interface PerpTradeResult {
  trades: number;
  wins: number;
  winRatePct: number;
  totalPnlPct: number;
  avgPnlPct: number;
  avgHoldBars: number;
}
/**
 * Trade the LIQUID perp toward fair value. Perp rich (deviation ≥ +entry) → SHORT perp; perp cheap
 * (deviation ≤ -entry) → LONG perp. Exit when |deviation| ≤ exit. PnL = actual perp price move
 * between entry and exit (real, fillable), in %, net of round-trip fee. This is a single-leg trade
 * on the instrument that actually has volume — not a synthetic two-leg basis on an untradeable token.
 */
export function perpConvergenceBacktest(series: PerpPoint[], entryPct: number, exitPct: number, feePct: number): PerpTradeResult {
  let pos: { side: "long" | "short"; entryPx: number; entryIdx: number } | null = null;
  let trades = 0;
  let wins = 0;
  let totalPnlPct = 0;
  let holdSum = 0;
  for (let i = 0; i < series.length; i++) {
    const d = series[i].deviationPct;
    if (!pos) {
      if (d <= -entryPct) pos = { side: "long", entryPx: series[i].perpClose, entryIdx: i };
      else if (d >= entryPct) pos = { side: "short", entryPx: series[i].perpClose, entryIdx: i };
    } else if (Math.abs(d) <= exitPct) {
      const px = series[i].perpClose;
      const grossPct = pos.side === "long" ? ((px - pos.entryPx) / pos.entryPx) * 100 : ((pos.entryPx - px) / pos.entryPx) * 100;
      const net = grossPct - feePct;
      trades++;
      if (net > 0) wins++;
      totalPnlPct += net;
      holdSum += i - pos.entryIdx;
      pos = null;
    }
  }
  return {
    trades,
    wins,
    winRatePct: trades ? Number(((wins / trades) * 100).toFixed(1)) : 0,
    totalPnlPct: Number(totalPnlPct.toFixed(3)),
    avgPnlPct: trades ? Number((totalPnlPct / trades).toFixed(3)) : 0,
    avgHoldBars: trades ? Number((holdSum / trades).toFixed(1)) : 0,
  };
}
