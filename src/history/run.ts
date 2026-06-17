// Historical evidence runner — fetches real Bitget rToken + perp candles for the whole basis-pair
// universe and produces the Track-3 evidence: convergence-capture rate (C), peg-tracking-error (B),
// a fee-netted basis backtest (A), an out-of-sample split (D), and a cost sweep (E).
// `npm run backtest`. Saves a JSON report to data/research/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { basisPairs } from "../universe";
import { spotCandles, perpCandles } from "../bitget/client";
import { equityCandles } from "../anchor/equity";
import {
  buildPremiumSeries,
  convergenceCapture,
  pegTrackingError,
  basisBacktest,
  randomBaseline,
  convergenceCaptureShuffled,
  clairvoyantBound,
  trueGapReversion,
  gapReversionBuckets,
  type PremiumPoint,
  type Bar,
} from "./study";
import { buildPerpSeries, perpConvergence, perpConvergenceBacktest, type PerpPoint } from "./perpconv";
import { halfLifeBars, median, alignCrossSection, crossSectionalStress } from "./signals";
import { riskAdjusted, bootstrapMeanCI } from "./metrics";
import { sessionFor } from "../orchestrator/session";

const lim = pLimit(6);

export interface HistoryOptions {
  granularity?: "1h" | "1day";
  horizon?: number;
  stretchPct?: number;
  entryPct?: number;
  exitPct?: number;
  feePct?: number;
  minPoints?: number;
}

interface PairSeries {
  ticker: string;
  series: PremiumPoint[];
  perpSeries: PerpPoint[];
  rBars: Bar[];
  eqBars: Bar[];
}

async function fetchPair(p: (typeof basisPairs)[number], gran: "1h" | "1day"): Promise<PairSeries | null> {
  const sg = gran;
  const pg = gran === "1h" ? "1H" : "1D";
  const [r, perp, eq] = await Promise.all([
    lim(() => spotCandles(p.rtoken_spot, sg, 1000)).catch(() => [] as Bar[]),
    lim(() => perpCandles(p.perp, pg, 1000)).catch(() => [] as Bar[]),
    lim(() => equityCandles(p.ticker, "6mo")).catch(() => [] as Bar[]),
  ]);
  return { ticker: p.ticker, series: buildPremiumSeries(r, perp), perpSeries: buildPerpSeries(perp, r), rBars: r, eqBars: eq };
}

export async function runHistoryStudy(opts: HistoryOptions = {}) {
  const gran = opts.granularity ?? "1h";
  const horizon = opts.horizon ?? (gran === "1h" ? 6 : 1);
  const stretch = opts.stretchPct ?? 0.5;
  const entry = opts.entryPct ?? 1.0;
  const exit = opts.exitPct ?? 0.3;
  const fee = opts.feePct ?? 0.5;
  const minPoints = opts.minPoints ?? 50;
  // Time-stop for the survivorship-free basis backtest: a non-converging position is force-closed
  // (and counted as a loss) after this many bars. ~2 trading days on 1h, ~1 week on 1day.
  const maxHold = gran === "1h" ? 48 : 5;

  const fetched = (await Promise.all(basisPairs.map((p) => fetchPair(p, gran)))).filter(
    (x): x is PairSeries => !!x && x.series.length >= minPoints
  );

  // pooled aggregates
  let totEvents = 0,
    totCaptured = 0,
    totNarrow = 0;
  let totTrades = 0,
    totWins = 0,
    totPnl = 0,
    totLosses = 0,
    totForced = 0,
    totHoldWeighted = 0;
  let trackImprovements: number[] = [];
  const perPair: any[] = [];
  const allPnls: number[] = []; // pooled per-trade basis PnLs → risk-adjusted metrics
  let clairPnl = 0; // pooled perfect-hindsight max convergence
  let clairOpps = 0;

  // honesty controls (pooled): random-entry baseline + shuffle test
  let rndCapHits = 0,
    rndCapTotal = 0,
    rndBasisPnl = 0;
  let shCapHits = 0,
    shCapTotal = 0;

  // perp-leg (tradeable) aggregates
  const perpFee = 0.12; // round-trip perp taker (~0.06% × 2)
  let pEvents = 0,
    pCaptured = 0,
    pTrades = 0,
    pWins = 0,
    pPnl = 0,
    pHoldWeighted = 0;

  for (const { ticker, series, perpSeries } of fetched) {
    const cap = convergenceCapture(series, stretch, horizon);
    const trk = pegTrackingError(series, horizon);
    const bt = basisBacktest(series, entry, exit, fee, maxHold);
    totEvents += cap.events;
    totCaptured += cap.captured;
    totNarrow += cap.avgNarrowingPct * cap.events;
    totTrades += bt.trades;
    totWins += bt.wins;
    totLosses += bt.losses;
    totForced += bt.forcedExits;
    totPnl += bt.totalPnlPct;
    totHoldWeighted += bt.avgHoldBars * bt.trades;
    allPnls.push(...bt.pnls);
    const cb = clairvoyantBound(series, entry, fee, maxHold);
    clairPnl += cb.maxPnlPct;
    clairOpps += cb.opportunities;
    if (trk.n > 0) trackImprovements.push(trk.improvementPct);

    // controls, matched in entry-count to this pair's real basis trades
    const rb = randomBaseline(series, horizon, exit, fee, bt.trades, maxHold);
    rndCapHits += rb.capHits;
    rndCapTotal += rb.capTotal;
    rndBasisPnl += rb.basisPnlPct;
    const sh = convergenceCaptureShuffled(series, stretch, horizon);
    shCapHits += sh.capHits;
    shCapTotal += sh.capTotal;

    const pc = perpConvergence(perpSeries, stretch, horizon);
    const pbt = perpConvergenceBacktest(perpSeries, entry, exit, perpFee);
    pEvents += pc.events;
    pCaptured += pc.captured;
    pTrades += pbt.trades;
    pWins += pbt.wins;
    pPnl += pbt.totalPnlPct;
    pHoldWeighted += pbt.avgHoldBars * pbt.trades;

    perPair.push({ ticker, points: series.length, captureRatePct: cap.ratePct, events: cap.events, trackingImprovementPct: trk.improvementPct, basisTrades: bt.trades, basisWinRatePct: bt.winRatePct, basisPnlPct: bt.totalPnlPct, basisForced: bt.forcedExits, perpTrades: pbt.trades, perpPnlPct: pbt.totalPnlPct, perpWinRatePct: pbt.winRatePct });
  }

  // out-of-sample (D): split each series 60/40 by time, pooled capture on each half
  const oos = (sliceFn: (s: PremiumPoint[]) => PremiumPoint[]) => {
    let e = 0,
      c = 0;
    for (const { series } of fetched) {
      const r = convergenceCapture(sliceFn(series), stretch, horizon);
      e += r.events;
      c += r.captured;
    }
    return { events: e, captured: c, ratePct: e ? Number(((c / e) * 100).toFixed(1)) : 0 };
  };
  const inSample = oos((s) => s.slice(0, Math.floor(s.length * 0.6)));
  const outSample = oos((s) => s.slice(Math.floor(s.length * 0.6)));

  // cost sweep (E): basis PnL at several fee assumptions
  const costSweep = [0.3, 0.5, 0.8].map((f) => {
    let t = 0,
      pnl = 0,
      w = 0;
    for (const { series } of fetched) {
      const b = basisBacktest(series, entry, exit, f, maxHold);
      t += b.trades;
      pnl += b.totalPnlPct;
      w += b.wins;
    }
    return { feePct: f, trades: t, winRatePct: t ? Number(((w / t) * 100).toFixed(1)) : 0, totalPnlPct: Number(pnl.toFixed(2)) };
  });

  const meanTrackImprovement = trackImprovements.length
    ? Number((trackImprovements.reduce((a, b) => a + b, 0) / trackImprovements.length).toFixed(2))
    : 0;
  const positiveTrackPairs = trackImprovements.filter((x) => x > 0).length;

  // honesty controls (pooled)
  const realCaptureRate = totEvents ? (totCaptured / totEvents) * 100 : 0;
  const randomCaptureRate = rndCapTotal ? (rndCapHits / rndCapTotal) * 100 : 0;
  const shuffledCaptureRate = shCapTotal ? (shCapHits / shCapTotal) * 100 : 0;
  const control = {
    note: "random = same #entries at random bars/sides under identical exit+fee+time-stop; shuffle = premium series time-order destroyed. Edge is real only if real clears these.",
    randomEntry: { captureRatePct: Number(randomCaptureRate.toFixed(1)), basisPnlPct: Number(rndBasisPnl.toFixed(2)) },
    shuffledSeries: { captureRatePct: Number(shuffledCaptureRate.toFixed(1)) },
    edgeOverRandom: {
      capturePts: Number((realCaptureRate - randomCaptureRate).toFixed(1)),
      basisPnlPct: Number((totPnl - rndBasisPnl).toFixed(2)),
    },
    captureVsShufflePts: Number((realCaptureRate - shuffledCaptureRate).toFixed(1)),
  };

  // ── Phase-2 signal tests (honest: do these signals actually improve the edge?) ──
  // (F) Half-life selectivity: split pairs into fast- vs slow-reverting, compare basis edge-over-random.
  const hlByTicker = new Map<string, number>();
  for (const { ticker, series } of fetched) hlByTicker.set(ticker, halfLifeBars(series));
  const medHl = median([...hlByTicker.values()]);
  const splitBasis = (wantFast: boolean) => {
    let t = 0,
      w = 0,
      pnl = 0,
      rnd = 0;
    for (const { ticker, series } of fetched) {
      const hl = hlByTicker.get(ticker)!;
      const isFast = Number.isFinite(hl) && hl <= medHl;
      if (isFast !== wantFast) continue;
      const b = basisBacktest(series, entry, exit, fee, maxHold);
      t += b.trades;
      w += b.wins;
      pnl += b.totalPnlPct;
      rnd += randomBaseline(series, horizon, exit, fee, b.trades, maxHold).basisPnlPct;
    }
    return {
      trades: t,
      winRatePct: t ? Number(((w / t) * 100).toFixed(1)) : 0,
      pnlPct: Number(pnl.toFixed(2)),
      edgeOverRandomPct: Number((pnl - rnd).toFixed(2)),
    };
  };
  const halfLife = { medianBars: Number(medHl.toFixed(1)), fast: splitBasis(true), slow: splitBasis(false) };

  // (G) Basket co-depeg: do stretches during HIGH cross-sectional stress converge more than isolated ones?
  const xsec = alignCrossSection(new Map(fetched.map((f) => [f.ticker, f.series])));
  const stressByTs = new Map<number, number>();
  for (const [ts, row] of xsec) stressByTs.set(ts, crossSectionalStress(row));
  const medStress = median([...stressByTs.values()]);
  let hiEv = 0,
    hiCap = 0,
    loEv = 0,
    loCap = 0;
  for (const { series } of fetched) {
    for (let i = 0; i + horizon < series.length; i++) {
      const p0 = Math.abs(series[i].premiumPct);
      if (p0 < stretch) continue;
      const narrowed = Math.abs(series[i + horizon].premiumPct) < p0 ? 1 : 0;
      if ((stressByTs.get(series[i].ts) ?? 0) >= medStress) {
        hiEv++;
        hiCap += narrowed;
      } else {
        loEv++;
        loCap += narrowed;
      }
    }
  }
  const basket = {
    medianStressPct: Number(medStress.toFixed(3)),
    highStress: { events: hiEv, captureRatePct: hiEv ? Number(((hiCap / hiEv) * 100).toFixed(1)) : 0 },
    lowStress: { events: loEv, captureRatePct: loEv ? Number(((loCap / loEv) * 100).toFixed(1)) : 0 },
  };

  // (H) Risk-adjusted metrics over pooled per-trade basis PnLs (the credible evaluation stack).
  const risk = riskAdjusted(allPnls);
  // (H2) Bootstrap 95% CI on the per-trade basis PnL — the small-sample honesty answer.
  const edgeCI = bootstrapMeanCI(allPnls);

  // (I) Walk-forward: capture across sequential time folds — proves stability, not one lucky split.
  const FOLDS = 4;
  const walkForward = Array.from({ length: FOLDS }, (_, k) => {
    let e = 0;
    let c = 0;
    for (const { series } of fetched) {
      const n = series.length;
      const r = convergenceCapture(series.slice(Math.floor((n * k) / FOLDS), Math.floor((n * (k + 1)) / FOLDS)), stretch, horizon);
      e += r.events;
      c += r.captured;
    }
    return { fold: k + 1, events: e, captured: c, ratePct: e ? Number(((c / e) * 100).toFixed(1)) : 0 };
  });

  // (L) Regime split: convergence capture bucketed by the session phase of the entry bar — shows
  // WHERE the measured convergence concentrates (a diagnostic; capture% is an artifact, not edge).
  const regimeAgg: Record<string, { events: number; captured: number }> = {};
  for (const { series } of fetched) {
    for (let i = 0; i + horizon < series.length; i++) {
      const p0 = Math.abs(series[i]!.premiumPct);
      if (p0 < stretch) continue;
      const phase = sessionFor(series[i]!.ts).phase;
      const narrowed = Math.abs(series[i + horizon]!.premiumPct) < p0 ? 1 : 0;
      (regimeAgg[phase] ??= { events: 0, captured: 0 }).events++;
      regimeAgg[phase]!.captured += narrowed;
    }
  }
  const regimeSplit = Object.entries(regimeAgg)
    .map(([phase, a]) => ({ phase, events: a.events, captureRatePct: a.events ? Number(((a.captured / a.events) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.events - a.events);

  // (K) True-gap reversion (open-horizon edge) — daily only; pooled n-weighted across pairs.
  let revN = 0;
  let revRetW = 0;
  let revCorrW = 0;
  const revBaselines: number[] = [];
  const cheapRets: number[] = [];
  const richRets: number[] = [];
  if (gran === "1day") {
    for (const f of fetched) {
      const gr = trueGapReversion(f.rBars, f.eqBars, 1);
      if (!gr.n) continue;
      revN += gr.n;
      revRetW += gr.reversionReturnPct * gr.n;
      revCorrW += gr.correctiveRatePct * gr.n;
      if (gr.baselineAbsRetPct > 0) revBaselines.push(gr.baselineAbsRetPct);
      if (gr.cheapNextRetPct !== 0) cheapRets.push(gr.cheapNextRetPct);
      if (gr.richNextRetPct !== 0) richRets.push(gr.richNextRetPct);
    }
  }
  const mean = (xs: number[]) => (xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : 0);
  const gapReversion = {
    n: revN,
    reversionReturnPct: revN ? Number((revRetW / revN).toFixed(3)) : 0,
    correctiveRatePct: revN ? Number((revCorrW / revN).toFixed(1)) : 0,
    baselineAbsRetPct: mean(revBaselines),
    cheapNextRetPct: mean(cheapRets),
    richNextRetPct: mean(richRets),
  };

  // (K2) Regime discovery — reversion sliced by gap-size bucket (pooled exactly across pairs).
  const bucketMap = new Map<string, { n: number; corrective: number; revSum: number }>();
  if (gran === "1day") {
    for (const f of fetched) {
      for (const b of gapReversionBuckets(f.rBars, f.eqBars)) {
        const a = bucketMap.get(b.label) ?? { n: 0, corrective: 0, revSum: 0 };
        a.n += b.n;
        a.corrective += b.corrective;
        a.revSum += b.reversionSumPct;
        bucketMap.set(b.label, a);
      }
    }
  }
  const reversionByGapSize = [...bucketMap.entries()].map(([label, a]) => ({
    label,
    n: a.n,
    correctiveRatePct: a.n ? Number(((a.corrective / a.n) * 100).toFixed(1)) : 0,
    reversionReturnPct: a.n ? Number((a.revSum / a.n).toFixed(3)) : 0,
  }));

  const report = {
    generatedTs: Date.now(),
    config: { granularity: gran, horizon, stretchPct: stretch, entryPct: entry, exitPct: exit, feePct: fee },
    pairsWithData: fetched.length,
    totalPremiumObservations: fetched.reduce((a, s) => a + s.series.length, 0),
    convergenceCapture: {
      events: totEvents,
      captured: totCaptured,
      ratePct: totEvents ? Number(((totCaptured / totEvents) * 100).toFixed(1)) : 0,
      avgNarrowingPct: totEvents ? Number((totNarrow / totEvents).toFixed(4)) : 0,
    },
    pegTrackingError: { meanImprovementPct: meanTrackImprovement, pairsPositive: positiveTrackPairs, pairsTotal: trackImprovements.length },
    basisBacktest: {
      trades: totTrades,
      winRatePct: totTrades ? Number(((totWins / totTrades) * 100).toFixed(1)) : 0,
      totalPnlPct: Number(totPnl.toFixed(2)),
      losses: totLosses,
      forcedExits: totForced,
      avgHoldBars: totTrades ? Number((totHoldWeighted / totTrades).toFixed(1)) : 0,
      note: "survivorship-free: non-converging positions are time-stopped/marked-to-end and counted as losses (forcedExits)",
    },
    control,
    perpLeg: {
      convergence: { events: pEvents, captured: pCaptured, ratePct: pEvents ? Number(((pCaptured / pEvents) * 100).toFixed(1)) : 0 },
      backtest: {
        trades: pTrades,
        winRatePct: pTrades ? Number(((pWins / pTrades) * 100).toFixed(1)) : 0,
        totalPnlPct: Number(pPnl.toFixed(2)),
        avgHoldBars: pTrades ? Number((pHoldWeighted / pTrades).toFixed(1)) : 0,
      },
    },
    outOfSample: { inSample, outSample },
    costSweep,
    riskAdjusted: risk,
    edgeCI,
    walkForward,
    regimeSplit,
    gapReversion,
    reversionByGapSize,
    clairvoyant: {
      opportunities: clairOpps,
      maxPnlPct: Number(clairPnl.toFixed(2)),
      capturedPctOfMax: clairPnl > 0 ? Number(((totPnl / clairPnl) * 100).toFixed(1)) : 0,
    },
    signals: { halfLife, basket },
    perPair,
  };

  return report;
}

export async function printHistoryStudy(opts: HistoryOptions = {}): Promise<void> {
  console.log("Fetching real Bitget rToken + perp history for all basis pairs…");
  const rep = await runHistoryStudy(opts);
  const c = rep.config;
  console.log(`\n══════════ NightDesk — historical evidence (real Bitget US-stock data) ══════════`);
  console.log(`config: ${c.granularity} bars, horizon=${c.horizon}, stretch≥${c.stretchPct}%, basis entry/exit ${c.entryPct}/${c.exitPct}%, fee ${c.feePct}%`);
  console.log(`coverage: ${rep.pairsWithData} pairs, ${rep.totalPremiumObservations} premium observations\n`);
  console.log(`C · CONVERGENCE CAPTURE: ${rep.convergenceCapture.ratePct}%  (${rep.convergenceCapture.captured}/${rep.convergenceCapture.events} stretched premiums narrowed within ${c.horizon} bars; avg narrowing ${rep.convergenceCapture.avgNarrowingPct}pp)`);
  console.log(`B · PEG-TRACKING EDGE: perp anchor beats last-close on ${rep.pegTrackingError.pairsPositive}/${rep.pegTrackingError.pairsTotal} pairs, mean improvement ${rep.pegTrackingError.meanImprovementPct}%`);
  const b = rep.basisBacktest;
  console.log(`A · BASIS BACKTEST (survivorship-free): ${b.trades} trades, win-rate ${b.winRatePct}%, total ${b.totalPnlPct}pp net of fees · losers ${b.losses}, force-closed ${b.forcedExits}, avg hold ${b.avgHoldBars} bars  (premium-space; assumes mark-price rToken fills)`);
  const ctl = rep.control;
  console.log(`A·CONTROL — IS THE EDGE REAL?`);
  console.log(`     random-entry baseline: capture ${ctl.randomEntry.captureRatePct}%, basis PnL ${ctl.randomEntry.basisPnlPct}pp  →  EDGE OVER RANDOM: capture ${ctl.edgeOverRandom.capturePts >= 0 ? "+" : ""}${ctl.edgeOverRandom.capturePts}pts, PnL ${ctl.edgeOverRandom.basisPnlPct >= 0 ? "+" : ""}${ctl.edgeOverRandom.basisPnlPct}pp`);
  console.log(`     shuffled-series capture: ${ctl.shuffledSeries.captureRatePct}%  →  real capture beats shuffle by ${ctl.captureVsShufflePts >= 0 ? "+" : ""}${ctl.captureVsShufflePts}pts (temporal structure ${ctl.captureVsShufflePts > 5 ? "REAL" : "WEAK/ARTIFACT"})`);
  console.log(`A* · PERP-LEG (TRADEABLE) BACKTEST: ${rep.perpLeg.backtest.trades} trades, win-rate ${rep.perpLeg.backtest.winRatePct}%, total ${rep.perpLeg.backtest.totalPnlPct}% on the LIQUID perp (real fills), avg hold ${rep.perpLeg.backtest.avgHoldBars} bars · perp→fair-value convergence ${rep.perpLeg.convergence.ratePct}% (${rep.perpLeg.convergence.captured}/${rep.perpLeg.convergence.events})`);
  console.log(`D · OUT-OF-SAMPLE capture: in-sample ${rep.outOfSample.inSample.ratePct}% → out-of-sample ${rep.outOfSample.outSample.ratePct}%`);
  console.log(`E · COST SWEEP:`);
  for (const cs of rep.costSweep) console.log(`     fee ${cs.feePct}% → ${cs.trades} trades, win ${cs.winRatePct}%, total ${cs.totalPnlPct}pp`);
  const hl = rep.signals.halfLife;
  console.log(`F · SIGNAL TEST — HALF-LIFE SELECTIVITY (median ${hl.medianBars} bars; lower = faster reversion):`);
  console.log(`     fast-reverting pairs: ${hl.fast.trades} trades, win ${hl.fast.winRatePct}%, PnL ${hl.fast.pnlPct}pp, edge-over-random ${hl.fast.edgeOverRandomPct >= 0 ? "+" : ""}${hl.fast.edgeOverRandomPct}pp`);
  console.log(`     slow/non-reverting:   ${hl.slow.trades} trades, win ${hl.slow.winRatePct}%, PnL ${hl.slow.pnlPct}pp, edge-over-random ${hl.slow.edgeOverRandomPct >= 0 ? "+" : ""}${hl.slow.edgeOverRandomPct}pp`);
  const bk = rep.signals.basket;
  console.log(`G · SIGNAL TEST — BASKET CO-DEPEG (median basket stress ${bk.medianStressPct}%):`);
  console.log(`     high-stress (many tokens off together): ${bk.highStress.events} events, capture ${bk.highStress.captureRatePct}%`);
  console.log(`     low-stress (isolated dislocation):       ${bk.lowStress.events} events, capture ${bk.lowStress.captureRatePct}%`);
  const ra = rep.riskAdjusted;
  console.log(`H · RISK-ADJUSTED (basis, ${ra.trades} trades): Sharpe ${ra.sharpe}, Sortino ${ra.sortino}, maxDD ${ra.maxDrawdownPct}pp, profitFactor ${ra.profitFactor}, avg ${ra.avgReturnPct}pp/trade`);
  const ci = rep.edgeCI;
  console.log(`H2 · BOOTSTRAP 95% CI on per-trade basis PnL: mean ${ci.mean}pp, [${ci.lo}, ${ci.hi}] over n=${ci.n} — ${ci.excludesZero ? "excludes 0 (distinguishable from noise)" : "STRADDLES 0 (not distinguishable from noise at this sample)"}`);
  console.log(`I · WALK-FORWARD capture by time fold: ${rep.walkForward.map((f) => `f${f.fold}=${f.ratePct}%(${f.events}ev)`).join("  ")}`);
  console.log(`L · REGIME SPLIT (capture by session phase of entry, diagnostic): ${rep.regimeSplit.map((r) => `${r.phase}=${r.captureRatePct}%(${r.events}ev)`).join("  ")}`);
  const cv = rep.clairvoyant;
  console.log(`J · CLAIRVOYANT FRONTIER: captured ${cv.capturedPctOfMax}% of the perfect-hindsight max (${rep.basisBacktest.totalPnlPct}pp of ${cv.maxPnlPct}pp extractable across ${cv.opportunities} opportunities)`);
  const gr = rep.gapReversion;
  if (gr.n > 0) {
    console.log(
      `K · TRUE-GAP REVERSION (open-horizon edge · daily · look-ahead-safe): ${gr.n} dislocations → mean reversion ${gr.reversionReturnPct >= 0 ? "+" : ""}${gr.reversionReturnPct}%/session, corrective ${gr.correctiveRatePct}% (noise floor ${gr.baselineAbsRetPct}%)`
    );
    console.log(`     cheap rTokens next-session ${gr.cheapNextRetPct >= 0 ? "+" : ""}${gr.cheapNextRetPct}% (expect +)  ·  rich rTokens ${gr.richNextRetPct >= 0 ? "+" : ""}${gr.richNextRetPct}% (expect −)`);
    if (rep.reversionByGapSize.length) {
      console.log(`K2 · REGIME (reversion by gap size): ${rep.reversionByGapSize.map((b) => `${b.label}=${b.correctiveRatePct}%/${b.reversionReturnPct >= 0 ? "+" : ""}${b.reversionReturnPct}%(${b.n})`).join("  ")}`);
    }
  } else {
    console.log(`K · TRUE-GAP REVERSION: n/a (daily-only — run \`npm run backtest -- --daily\`; needs equity history)`);
  }
  const top = [...rep.perPair].sort((a, b) => b.captureRatePct - a.captureRatePct).slice(0, 8);
  console.log(`\nper-pair (top by capture rate):`);
  for (const p of top) console.log(`  ${p.ticker.padEnd(6)} pts=${String(p.points).padStart(4)}  capture=${p.captureRatePct}%  trackΔ=${p.trackingImprovementPct}%  basis=${p.basisPnlPct}pp/${p.basisTrades}t`);

  const dir = join(process.cwd(), "data", "research");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `history-study-${c.granularity}.json`);
  writeFileSync(file, JSON.stringify(rep, null, 2));
  console.log(`\nfull report → ${file}`);
}
