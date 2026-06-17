// Builds one PegWatch snapshot: fetch every basis pair's legs (concurrency-limited),
// compute premium / depeg state / sValue-adjusted triangulation. Shared by status + recorder.
// Legs carry raw bid/ask/last (+ rToken L2 top-5) so the snapshot doubles as a BitSim replay feed.
import pLimit from "p-limit";
import { basisPairs, tripleListed } from "../universe";
import { spotTicker, perpTicker, spotBook, type TickerQuote, type Book } from "../bitget/client";
import { equityQuotes, type EquityQuote } from "../anchor/equity";
import {
  mid,
  premiumPct,
  classifyDepeg,
  isTradeable,
  sValueAdjust,
  triangulate,
  type DepegState,
  type TriResult,
  type Quote,
} from "./fairvalue";

const lim = pLimit(8);
const tripleSet = new Set(tripleListed.map((p) => p.ticker));
const BOOK_TOP_N = 5;

function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  return lim(fn).catch(() => null);
}

export interface LegQuote {
  symbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mid: number | null;
  ts: number | null;
  book?: { bids: [number, number][]; asks: [number, number][] };
}
export interface PegRow {
  ticker: string;
  rToken: (LegQuote & { bookLevels: number }) | null;
  perp: (LegQuote & { funding: number | null }) | null;
  ondo: (LegQuote & { midAdj: number | null }) | null;
  premiumPct: number | null; // rToken vs perp — cross-venue BASIS signal
  state: DepegState | null;
  tradeable: boolean;
  triangulation: TriResult | null; // only for triple-listed tickers
  // Real fair-value anchor (Yahoo): rToken vs the actual underlying stock price — the TRUE depeg.
  equity?: { price: number; previousClose: number | null; marketState: string; asOf: number | null } | null;
  premiumVsEquityPct?: number | null;
  stateVsEquity?: DepegState | null;
}
export interface Snapshot {
  ts: number;
  isoTime: string;
  rows: PegRow[];
}

const asQuote = (t: TickerQuote | null): Quote =>
  t ? { bid: t.bid, ask: t.ask, last: t.last } : { bid: null, ask: null, last: null };

function legFrom(t: TickerQuote | null, book?: Book | null): LegQuote | null {
  if (!t) return null;
  const m = mid(asQuote(t));
  const leg: LegQuote = { symbol: t.symbol, bid: t.bid, ask: t.ask, last: t.last, mid: m, ts: t.ts };
  if (book && book.levels > 0) {
    leg.book = { bids: book.bids.slice(0, BOOK_TOP_N), asks: book.asks.slice(0, BOOK_TOP_N) };
  }
  return leg;
}

export async function collect(): Promise<Snapshot> {
  const now = Date.now();
  // Real underlying-equity prices (one batched fetch), used as the true fair-value anchor.
  const eq = await equityQuotes(basisPairs.map((p) => p.ticker)).catch(() => new Map<string, EquityQuote>());
  const rows = await Promise.all(basisPairs.map((p) => buildRow(p, eq)));
  return { ts: now, isoTime: new Date(now).toISOString(), rows };
}

async function buildRow(p: (typeof basisPairs)[number], eq: Map<string, EquityQuote>): Promise<PegRow> {
  const [rt, rtBook, pp, on] = await Promise.all([
    safe(() => spotTicker(p.rtoken_spot)),
    safe(() => spotBook(p.rtoken_spot)),
    safe(() => perpTicker(p.perp)),
    p.ondo_spot ? safe(() => spotTicker(p.ondo_spot!)) : Promise.resolve(null),
  ]);

  const rLeg = legFrom(rt, rtBook);
  const pLeg = legFrom(pp);
  const oLeg = legFrom(on);

  const rMid = rLeg?.mid ?? null;
  const pMid = pLeg?.mid ?? null;
  const oMid = oLeg?.mid ?? null;
  const oAdj = oMid != null ? sValueAdjust(oMid, 1.0) : null; // v0 multiplier 1.0

  let premium: number | null = null;
  let state: DepegState | null = null;
  let tradeable = false;
  if (rMid != null && pMid != null) {
    premium = premiumPct(rMid, pMid);
    state = classifyDepeg(Math.abs(premium));
    tradeable = isTradeable(Math.abs(premium));
  }

  const tri = tripleSet.has(p.ticker) ? triangulate({ rToken: rMid, perp: pMid, ondoAdj: oAdj }) : null;

  // True depeg: rToken vs the REAL underlying stock price (off-hours = last NYSE close).
  const equity = eq.get(p.ticker) ?? null;
  let premiumVsEquityPct: number | null = null;
  let stateVsEquity: DepegState | null = null;
  if (rMid != null && equity && equity.price > 0) {
    premiumVsEquityPct = premiumPct(rMid, equity.price);
    stateVsEquity = classifyDepeg(Math.abs(premiumVsEquityPct));
  }

  return {
    ticker: p.ticker,
    rToken: rLeg ? { ...rLeg, bookLevels: rtBook ? rtBook.levels : 0 } : null,
    perp: pLeg ? { ...pLeg, funding: pp?.fundingRate ?? null } : null,
    ondo: oLeg ? { ...oLeg, midAdj: oAdj } : null,
    premiumPct: premium,
    state,
    tradeable,
    triangulation: tri,
    equity: equity
      ? { price: equity.price, previousClose: equity.previousClose, marketState: equity.marketState, asOf: equity.asOf }
      : null,
    premiumVsEquityPct,
    stateVsEquity,
  };
}
