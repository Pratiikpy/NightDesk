// Thin client over VERIFIED public Bitget endpoints (see verification-log.md).
// No auth needed for market data. Data-trap guards baked in:
//  - never expose spot ticker `usdtVolume` (garbage for rTokens)
//  - empty bids/asks array => "no book, use ticker quote"
//  - clock-skew-tolerant freshness helper

const BASE = "https://api.bitget.com";

function num(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

interface Envelope<T> {
  code: string;
  msg: string;
  data: T;
}

async function request<T>(path: string, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(BASE + path, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Envelope<T>;
      if (json.code !== "00000") throw new Error(`Bitget ${json.code}: ${json.msg}`);
      return json.data;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

export interface TickerQuote {
  symbol: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  bidSz: number | null;
  askSz: number | null;
  ts: number | null;
  fundingRate?: number | null;
}

export interface Book {
  bids: [number, number][];
  asks: [number, number][];
  levels: number; // min(bids,asks) — 0 means quote-only (no L2)
}

function parseBook(d: any): Book {
  const bids = (d?.bids ?? []).map((x: any[]) => [Number(x[0]), Number(x[1])] as [number, number]);
  const asks = (d?.asks ?? []).map((x: any[]) => [Number(x[0]), Number(x[1])] as [number, number]);
  return { bids, asks, levels: Math.min(bids.length, asks.length) };
}

export async function spotTicker(symbol: string): Promise<TickerQuote> {
  const d = await request<any[]>(`/api/v2/spot/market/tickers?symbol=${symbol}`);
  const t = d[0] ?? {};
  return {
    symbol,
    last: num(t.lastPr),
    bid: num(t.bidPr),
    ask: num(t.askPr),
    bidSz: num(t.bidSz),
    askSz: num(t.askSz),
    ts: num(t.ts),
    // NOTE: t.usdtVolume intentionally NOT surfaced — garbage for rTokens (verification-log V6)
  };
}

export async function perpTicker(symbol: string): Promise<TickerQuote> {
  const d = await request<any[]>(`/api/v2/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`);
  const t = d[0] ?? {};
  return {
    symbol,
    last: num(t.lastPr),
    bid: num(t.bidPr),
    ask: num(t.askPr),
    bidSz: num(t.bidSz),
    askSz: num(t.askSz),
    ts: num(t.ts),
    fundingRate: num(t.fundingRate),
  };
}

export async function spotBook(symbol: string, limit = 15): Promise<Book> {
  const d = await request<any>(`/api/v2/spot/market/orderbook?symbol=${symbol}&limit=${limit}`);
  return parseBook(d);
}

export async function perpBook(symbol: string, limit = 15): Promise<Book> {
  const d = await request<any>(`/api/v2/mix/market/merge-depth?symbol=${symbol}&productType=USDT-FUTURES&limit=${limit}`);
  return parseBook(d);
}

export function freshnessSec(ts: number | null, now = Date.now()): number | null {
  if (ts == null) return null;
  return Math.max(0, (now - ts) / 1000); // clock-skew tolerant (negative clamped to 0)
}

export interface Candle {
  ts: number;
  close: number;
}

/** Historical spot candles → [{ts, close}] (Bitget candle: [ts, o, h, l, close, baseVol, quoteVol]). */
export async function spotCandles(symbol: string, granularity = "1day", limit = 400): Promise<Candle[]> {
  const d = await request<string[][]>(`/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`);
  return d
    .map((c) => ({ ts: Number(c[0]), close: Number(c[4]) }))
    .filter((b) => Number.isFinite(b.ts) && Number.isFinite(b.close) && b.close > 0);
}

/** Historical perp candles → [{ts, close}]. */
export async function perpCandles(symbol: string, granularity = "1D", limit = 400): Promise<Candle[]> {
  const d = await request<string[][]>(
    `/api/v2/mix/market/candles?symbol=${symbol}&productType=USDT-FUTURES&granularity=${granularity}&limit=${limit}`
  );
  return d
    .map((c) => ({ ts: Number(c[0]), close: Number(c[4]) }))
    .filter((b) => Number.isFinite(b.ts) && Number.isFinite(b.close) && b.close > 0);
}
