// Per-token tracking-error-to-underlier + honest rights/risk flags.
//
// This answers the questions REAL tokenized-stock users ask (r/Tokenized): how tightly does the
// token track the underlying stock, and what rights/risks does it carry? We compute the MEASURABLE
// parts (tracking error, return correlation, liquidity quality) from real data, and we NEVER
// fabricate legal facts — dividends / voting / corporate-action handling are explicitly marked
// "not verified — see issuer," because NightDesk has no authoritative source for them. Honesty over
// hype: a transparency layer that invents rights would be the opposite of trustworthy.
//
// Tracking error aligns the rToken's daily close to the underlying's same-date NYSE close. This is
// approximate (the rToken bar is a 24/7 UTC day; the equity close is the NYSE close), which we note.

export interface Bar {
  ts: number;
  close: number;
}

export interface TrackingError {
  nDays: number;
  meanAbsPremiumPct: number; // average |rToken − stock| / stock  → how far off, on average
  stdevPremiumPct: number; // volatility of the gap
  maxAbsPremiumPct: number; // worst single-day dislocation
  returnCorrelation: number | null; // do daily moves track the stock? (1 = perfect)
}

const dayKey = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Align rToken daily candles to the underlying's same-date close → tracking-error stats. */
export function trackingError(rBars: Bar[], eqBars: Bar[]): TrackingError {
  const eqByDay = new Map<string, number>();
  for (const b of eqBars) if (b.close > 0) eqByDay.set(dayKey(b.ts), b.close);
  const byDay = new Map<string, { r: number; eq: number; prem: number }>();
  for (const b of rBars) {
    if (b.close <= 0) continue;
    const eq = eqByDay.get(dayKey(b.ts));
    if (eq != null && eq > 0) byDay.set(dayKey(b.ts), { r: b.close, eq, prem: ((b.close - eq) / eq) * 100 });
  }
  const rows = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((e) => e[1]);
  if (!rows.length) return { nDays: 0, meanAbsPremiumPct: 0, stdevPremiumPct: 0, maxAbsPremiumPct: 0, returnCorrelation: null };

  const prems = rows.map((r) => r.prem);
  const absP = prems.map(Math.abs);
  const meanAbs = absP.reduce((a, b) => a + b, 0) / absP.length;
  const meanPrem = prems.reduce((a, b) => a + b, 0) / prems.length;
  const sd = Math.sqrt(prems.reduce((a, b) => a + (b - meanPrem) ** 2, 0) / prems.length);
  const rRet: number[] = [];
  const eRet: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    rRet.push((rows[i].r - rows[i - 1].r) / rows[i - 1].r);
    eRet.push((rows[i].eq - rows[i - 1].eq) / rows[i - 1].eq);
  }
  const corr = pearson(rRet, eRet);
  return {
    nDays: rows.length,
    meanAbsPremiumPct: Number(meanAbs.toFixed(3)),
    stdevPremiumPct: Number(sd.toFixed(3)),
    maxAbsPremiumPct: Number(Math.max(...absP).toFixed(3)),
    returnCorrelation: corr == null ? null : Number(corr.toFixed(3)),
  };
}

export type TrackingGrade = "tight" | "loose" | "poor" | "n/a";

/**
 * Grade tracking from the ROBUST metric — the average daily level gap (meanAbsPremiumPct).
 * We deliberately do NOT grade on returnCorrelation: it is confounded because the rToken daily bar
 * closes at 00:00 UTC while the stock's daily close is the ~21:00 UTC NYSE close, so day-over-day
 * returns are measured at different times. Correlation is still reported, but as a caveated
 * diagnostic, not a grade input. (Matched-timestamp tracking comes from the live equity-aware
 * recorder, not daily candles.)
 */
export function trackingGrade(t: TrackingError): TrackingGrade {
  if (t.nDays < 5) return "n/a";
  if (t.meanAbsPremiumPct < 1.5) return "tight";
  if (t.meanAbsPremiumPct < 3) return "loose";
  return "poor";
}

export interface RightsFlags {
  ticker: string;
  // ── measured (real, computed from data) ──
  tracking: TrackingError;
  trackingGrade: TrackingGrade;
  liquidity: "L2-book" | "quote-only" | "unknown";
  // ── NOT fabricated: legal facts we do not have an authoritative source for ──
  dividends: string;
  votingRights: string;
  corporateActions: string;
  structure: string;
  note: string;
}

const NV = "not verified — see issuer";

export function buildRightsFlags(ticker: string, tracking: TrackingError, liquidity: RightsFlags["liquidity"]): RightsFlags {
  return {
    ticker,
    tracking,
    trackingGrade: trackingGrade(tracking),
    liquidity,
    dividends: NV,
    votingRights: NV,
    corporateActions: NV,
    structure: "Bitget rToken (intermediary-backed model; synthetic-vs-custodial not verified)",
    note: "meanAbs/stdev/max premium are robust daily level gaps. returnCorrelation is a CAVEATED diagnostic — confounded by rToken 00:00-UTC close vs ~21:00-UTC NYSE close; matched-timestamp tracking comes from the live equity-aware recorder. Legal rights are NOT asserted — confirm with the issuer.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token quality leaderboard.
//
// A single, TRANSPARENT reliability grade per tokenized stock — "how faithfully does this token
// represent the real stock, and how tradeable is it?" It is deliberately NOT an alpha/profit signal:
// it scores only MEASURABLE data-quality dimensions, and it EXCLUDES legal rights (which we never
// fabricate). Every component is shown so the grade can be audited, not trusted on faith.
//
//   tracking   = how close the token sits to the real-stock anchor (level gap)   weight 0.50
//   stability  = how steady that gap is (lower volatility = more predictable)  weight 0.30
//   liquidity  = is there an L2 book, or quote-only?                           weight 0.20
//
// Letter: A ≥ 85, B ≥ 70, C ≥ 55, else D. Tokens with < 5 aligned days are "n/a" (not enough data).
export interface TokenQuality {
  ticker: string;
  grade: "A" | "B" | "C" | "D" | "n/a";
  qualityScore: number; // 0–100 transparent reliability score (NOT alpha)
  components: { tracking: number; stability: number; liquidity: number };
  trackingGrade: TrackingGrade;
  liquidity: RightsFlags["liquidity"];
  meanAbsPremiumPct: number;
  maxAbsPremiumPct: number;
  rightsClarity: string; // always "not verified" — excluded from the score by design
}

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

export function tokenQuality(f: RightsFlags): TokenQuality {
  const t = f.tracking;
  const liquidity = f.liquidity === "L2-book" ? 100 : f.liquidity === "quote-only" ? 60 : 40;
  if (t.nDays < 5) {
    return {
      ticker: f.ticker,
      grade: "n/a",
      qualityScore: 0,
      components: { tracking: 0, stability: 0, liquidity },
      trackingGrade: f.trackingGrade,
      liquidity: f.liquidity,
      meanAbsPremiumPct: t.meanAbsPremiumPct,
      maxAbsPremiumPct: t.maxAbsPremiumPct,
      rightsClarity: "not verified",
    };
  }
  const tracking = clamp100(100 - t.meanAbsPremiumPct * 25); // 0% gap → 100, 4% gap → 0
  const stability = clamp100(100 - t.stdevPremiumPct * 25);
  const qualityScore = Number((0.5 * tracking + 0.3 * stability + 0.2 * liquidity).toFixed(1));
  const grade = qualityScore >= 85 ? "A" : qualityScore >= 70 ? "B" : qualityScore >= 55 ? "C" : "D";
  return {
    ticker: f.ticker,
    grade,
    qualityScore,
    components: { tracking: Math.round(tracking), stability: Math.round(stability), liquidity },
    trackingGrade: f.trackingGrade,
    liquidity: f.liquidity,
    meanAbsPremiumPct: t.meanAbsPremiumPct,
    maxAbsPremiumPct: t.maxAbsPremiumPct,
    rightsClarity: "not verified",
  };
}
