// Real underlying-equity price anchor — free, no API key (Yahoo Finance chart endpoint).
//
// WHY THIS EXISTS: our own backtest showed the Bitget perp is a WEAK fair-value anchor (peg-tracking
// improvement ≈ 0 — no better than the rToken's own last price). The honest fair value of a tokenized
// stock is the REAL stock price. Off-hours (nights/weekends) that is the last NYSE print
// (regularMarketPrice / previousClose). This module supplies it so PegWatch can report the TRUE
// depeg (rToken vs real equity) and keep rToken↔perp as a separate cross-venue BASIS signal.
//
// Honest caveat: off-hours the equity print is static (last close), which is exactly the right
// reference for "how far has the token drifted from fair value while Wall Street is shut."
import pLimit from "p-limit";

export type MarketState = "PRE" | "REGULAR" | "POST" | "CLOSED" | "UNKNOWN";

export interface EquityQuote {
  ticker: string;
  price: number; // latest print; off-hours = last regular-session close
  previousClose: number | null;
  currency: string | null;
  marketState: MarketState;
  asOf: number | null; // ms epoch of the print
  source: "yahoo";
}

const lim = pLimit(6);
const TTL_MS = 60_000;
const cache = new Map<string, { q: EquityQuote; at: number }>();
const YF = "https://query1.finance.yahoo.com/v8/finance/chart/";

/** Map a NightDesk ticker → Yahoo symbol (identity for standard US listings). */
export function yahooSymbol(ticker: string): string {
  return ticker.toUpperCase();
}

function normState(ms: string): MarketState {
  const s = ms.toUpperCase();
  if (s.startsWith("PRE")) return "PRE";
  if (s === "REGULAR") return "REGULAR";
  if (s.startsWith("POST")) return "POST";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

/** Pure parser for Yahoo's chart JSON → EquityQuote. Unit-tested offline (no network). */
export function parseYahooChart(ticker: string, json: any): EquityQuote | null {
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number" || meta.regularMarketPrice <= 0) return null;
  const prev =
    typeof meta.chartPreviousClose === "number"
      ? meta.chartPreviousClose
      : typeof meta.previousClose === "number"
        ? meta.previousClose
        : null;
  return {
    ticker: ticker.toUpperCase(),
    price: meta.regularMarketPrice,
    previousClose: prev,
    currency: meta.currency ?? null,
    marketState: normState(String(meta.marketState ?? "")),
    asOf: typeof meta.regularMarketTime === "number" ? meta.regularMarketTime * 1000 : null,
    source: "yahoo",
  };
}

async function fetchOne(ticker: string): Promise<EquityQuote | null> {
  const url = `${YF}${encodeURIComponent(yahooSymbol(ticker))}?interval=1d&range=5d`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (NightDesk PegWatch fair-value anchor)" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseYahooChart(ticker, await res.json());
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

/** Cached single equity quote (TTL 60s — off-hours prices barely move). */
export async function equityQuote(ticker: string, now = Date.now()): Promise<EquityQuote | null> {
  const key = ticker.toUpperCase();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.q;
  const q = await fetchOne(ticker);
  if (q) cache.set(key, { q, at: now });
  return q;
}

/** Batched quotes for many tickers (concurrency-limited; failures are omitted, never throw). */
export async function equityQuotes(tickers: string[]): Promise<Map<string, EquityQuote>> {
  const out = new Map<string, EquityQuote>();
  await Promise.all(
    tickers.map((t) =>
      lim(async () => {
        const q = await equityQuote(t).catch(() => null);
        if (q) out.set(t.toUpperCase(), q);
      })
    )
  );
  return out;
}


/** Pure parser for Yahoo daily history → [{ts, close}] (skips null/holiday gaps). */
export function parseYahooCandles(json: any): { ts: number; close: number }[] {
  const res = json?.chart?.result?.[0];
  const ts: unknown = res?.timestamp;
  const close: unknown = res?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) return [];
  const out: { ts: number; close: number }[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = close[i];
    if (typeof c === "number" && c > 0 && typeof ts[i] === "number") out.push({ ts: ts[i] * 1000, close: c });
  }
  return out;
}

/** Daily underlying-equity history (default ~3 months) for tracking-error vs the rToken. No key. */
export async function equityCandles(ticker: string, range = "3mo"): Promise<{ ts: number; close: number }[]> {
  const url = `${YF}${encodeURIComponent(yahooSymbol(ticker))}?interval=1d&range=${range}`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (NightDesk PegWatch fair-value anchor)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseYahooCandles(await res.json());
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return [];
}
