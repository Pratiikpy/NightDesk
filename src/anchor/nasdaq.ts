import pLimit from "p-limit";
import { easternClock } from "../data/market-calendar";
import type { EquityQuote, MarketState } from "./equity";

const BASE = "https://api.nasdaq.com/api/quote/";
const limit = pLimit(6);
const TTL_MS = 60_000;
const cache = new Map<string, { quote: EquityQuote; cachedAt: number }>();

function price(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function state(value: unknown): MarketState {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized.includes("PRE")) return "PRE";
  if (normalized.includes("AFTER") || normalized.includes("POST")) return "POST";
  if (normalized === "OPEN") return "REGULAR";
  if (normalized === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

const months: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseEasternTimestamp(value: string): number | null {
  const match = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+ET$/i.exec(value.trim());
  if (!match) return null;
  const month = months[match[1]!.toLowerCase()];
  if (month == null) return null;
  const year = Number(match[3]);
  const day = Number(match[2]);
  let hour = Number(match[4]) % 12;
  if (match[6]!.toUpperCase() === "PM") hour += 12;
  const minute = Number(match[5]);
  for (const offsetHours of [4, 5]) {
    const candidate = Date.UTC(year, month, day, hour + offsetHours, minute);
    const eastern = easternClock(candidate);
    if (eastern.date === `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` && eastern.hour === hour && eastern.minute === minute) {
      return candidate;
    }
  }
  return null;
}

export function parseNasdaqInfo(ticker: string, json: unknown): EquityQuote | null {
  const data = (json as { data?: Record<string, unknown> })?.data;
  const primary = data?.primaryData as Record<string, unknown> | undefined;
  const latest = price(primary?.lastSalePrice);
  if (!data || !primary || latest == null) return null;
  return {
    ticker: ticker.toUpperCase(),
    price: latest,
    previousClose: null,
    currency: "USD",
    marketState: state(data.marketStatus),
    asOf: parseEasternTimestamp(String(primary.lastTradeTimestamp ?? "")),
    source: "nasdaq",
  };
}

export type NasdaqAssetClass = "stocks" | "etf";

async function fetchOne(ticker: string, assetClass: NasdaqAssetClass): Promise<EquityQuote | null> {
  const url = `${BASE}${encodeURIComponent(ticker.toUpperCase())}/info?assetclass=${assetClass}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (NightDesk equity-anchor verification)",
          Accept: "application/json, text/plain, */*",
          Origin: "https://www.nasdaq.com",
          Referer: "https://www.nasdaq.com/",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseNasdaqInfo(ticker, await response.json());
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  return null;
}

export async function nasdaqQuote(ticker: string, now = Date.now(), assetClass: NasdaqAssetClass = "stocks"): Promise<EquityQuote | null> {
  const normalized = ticker.toUpperCase();
  const cacheKey = `${normalized}:${assetClass}`;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.cachedAt < TTL_MS) return hit.quote;
  const quote = await fetchOne(normalized, assetClass);
  if (quote) cache.set(cacheKey, { quote, cachedAt: now });
  return quote;
}

export async function nasdaqQuotes(tickers: string[], assetClasses: Readonly<Record<string, NasdaqAssetClass>> = {}): Promise<Map<string, EquityQuote>> {
  const output = new Map<string, EquityQuote>();
  await Promise.all(tickers.map((ticker) => limit(async () => {
    const quote = await nasdaqQuote(ticker, Date.now(), assetClasses[ticker.toUpperCase()] ?? "stocks").catch(() => null);
    if (quote) output.set(ticker.toUpperCase(), quote);
  })));
  return output;
}
