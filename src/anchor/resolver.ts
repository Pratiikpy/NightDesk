import { equityQuotes, type EquityQuote, type MarketState } from "./equity";
import { nasdaqQuotes, type NasdaqAssetClass } from "./nasdaq";

export type AnchorResolutionStatus = "consensus" | "single_source" | "contradiction" | "stale" | "unavailable";

export interface AnchorResolution {
  ticker: string;
  status: AnchorResolutionStatus;
  tradeable: boolean;
  quote: EquityQuote | null;
  sources: EquityQuote[];
  maxDeviationPct: number | null;
  reason: string;
}

export interface AnchorResolverOptions {
  maxDeviationPct?: number;
  liveMaxAgeMs?: number;
  closedMaxAgeMs?: number;
  maxFutureSkewMs?: number;
}

function active(state: MarketState): boolean {
  return state === "PRE" || state === "REGULAR" || state === "POST";
}

function fresh(quote: EquityQuote, now: number, options: Required<AnchorResolverOptions>): boolean {
  if (quote.asOf == null) return false;
  const age = now - quote.asOf;
  if (age < -options.maxFutureSkewMs) return false;
  return age <= (active(quote.marketState) ? options.liveMaxAgeMs : options.closedMaxAgeMs);
}

export function resolveEquityAnchor(
  ticker: string,
  quotes: EquityQuote[],
  now = Date.now(),
  input: AnchorResolverOptions = {},
): AnchorResolution {
  const options: Required<AnchorResolverOptions> = {
    maxDeviationPct: input.maxDeviationPct ?? 0.5,
    liveMaxAgeMs: input.liveMaxAgeMs ?? 5 * 60_000,
    closedMaxAgeMs: input.closedMaxAgeMs ?? 5 * 24 * 60 * 60_000,
    maxFutureSkewMs: input.maxFutureSkewMs ?? 2 * 60_000,
  };
  const valid = quotes.filter((quote) => quote.ticker.toUpperCase() === ticker.toUpperCase() && Number.isFinite(quote.price) && quote.price > 0);
  if (!valid.length) return { ticker, status: "unavailable", tradeable: false, quote: null, sources: [], maxDeviationPct: null, reason: "no valid equity anchor" };
  const freshQuotes = valid.filter((quote) => fresh(quote, now, options));
  if (!freshQuotes.length) return { ticker, status: "stale", tradeable: false, quote: null, sources: valid, maxDeviationPct: null, reason: "all equity anchors are stale or future-skewed" };
  if (freshQuotes.length < 2) return { ticker, status: "single_source", tradeable: false, quote: null, sources: freshQuotes, maxDeviationPct: null, reason: "independent equity-anchor confirmation unavailable" };
  const knownMarketStates = freshQuotes.filter((quote) => quote.marketState !== "UNKNOWN");
  if (!knownMarketStates.length) return { ticker, status: "contradiction", tradeable: false, quote: null, sources: freshQuotes, maxDeviationPct: null, reason: "equity market state cannot be confirmed" };
  const openStates = new Set(knownMarketStates.map((quote) => active(quote.marketState)));
  if (openStates.size > 1) return { ticker, status: "contradiction", tradeable: false, quote: null, sources: freshQuotes, maxDeviationPct: null, reason: "equity anchors disagree on market state" };
  const min = Math.min(...freshQuotes.map((quote) => quote.price));
  const max = Math.max(...freshQuotes.map((quote) => quote.price));
  const midpoint = (min + max) / 2;
  const maxDeviationPct = ((max - min) / midpoint) * 100;
  if (maxDeviationPct > options.maxDeviationPct) {
    return { ticker, status: "contradiction", tradeable: false, quote: null, sources: freshQuotes, maxDeviationPct, reason: `equity anchors diverge by ${maxDeviationPct.toFixed(4)}%` };
  }
  const selected = [...freshQuotes].sort(
    (a, b) => Number(a.marketState === "UNKNOWN") - Number(b.marketState === "UNKNOWN") || (b.asOf ?? 0) - (a.asOf ?? 0) || a.source.localeCompare(b.source),
  )[0]!;
  return {
    ticker,
    status: "consensus",
    tradeable: true,
    quote: {
      ...selected,
      previousClose: selected.previousClose ?? freshQuotes.find((quote) => quote.previousClose != null)?.previousClose ?? null,
      currency: selected.currency ?? freshQuotes.find((quote) => quote.currency != null)?.currency ?? null,
      source: "consensus",
      sources: freshQuotes.map((quote) => quote.source),
      maxDeviationPct,
      qualityStatus: "consensus",
    },
    sources: freshQuotes,
    maxDeviationPct,
    reason: "independent equity anchors agree",
  };
}

export async function redundantEquityQuotes(
  tickers: string[],
  now = Date.now(),
  assetClasses: Readonly<Record<string, NasdaqAssetClass>> = {},
): Promise<{ quotes: Map<string, EquityQuote>; resolutions: Map<string, AnchorResolution> }> {
  const [primary, secondary] = await Promise.all([equityQuotes(tickers), nasdaqQuotes(tickers, assetClasses)]);
  const quotes = new Map<string, EquityQuote>();
  const resolutions = new Map<string, AnchorResolution>();
  for (const ticker of tickers) {
    const normalized = ticker.toUpperCase();
    const candidates = [primary.get(normalized), secondary.get(normalized)].filter((quote): quote is EquityQuote => !!quote);
    const resolution = resolveEquityAnchor(normalized, candidates, now);
    resolutions.set(normalized, resolution);
    if (resolution.quote) quotes.set(normalized, resolution.quote);
  }
  return { quotes, resolutions };
}
