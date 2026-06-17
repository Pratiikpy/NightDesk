// Per-ticker stock news via Yahoo Finance search (free, no key). Used to tell a NEWS-DRIVEN
// dislocation (earnings, downgrade, lawsuit — the gap may be correct, don't fade) from a quiet
// liquidity gap (fade-able). The catalyst classifier is pure, deterministic, and LOOK-AHEAD-SAFE:
// it only counts headlines with publishedAt <= now (so a backtest can't peek at future news).

const YF_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";

export interface NewsItem {
  title: string;
  publisher: string;
  publishedAt: number; // ms epoch
  link: string;
}

/** Pure parser for the Yahoo search payload's `news` array. */
export function parseYahooNews(json: unknown): NewsItem[] {
  const news = (json as any)?.news;
  if (!Array.isArray(news)) return [];
  const out: NewsItem[] = [];
  for (const n of news) {
    if (n && typeof n.title === "string") {
      out.push({
        title: n.title,
        publisher: typeof n.publisher === "string" ? n.publisher : "",
        publishedAt: typeof n.providerPublishTime === "number" ? n.providerPublishTime * 1000 : 0,
        link: typeof n.link === "string" ? n.link : "",
      });
    }
  }
  return out;
}

export async function fetchTickerNews(ticker: string, count = 8): Promise<NewsItem[]> {
  const url = `${YF_SEARCH}?q=${encodeURIComponent(ticker)}&newsCount=${count}&quotesCount=0`;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (NightDesk perception)" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseYahooNews(await res.json());
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return [];
}

// Headlines that plausibly explain a real price move (a catalyst), not just chatter.
const CATALYST = [
  /earnings/i, /guidance/i, /downgrade/i, /upgrade/i, /lawsuit/i, /\bsec\b/i, /probe/i, /investigat/i,
  /recall/i, /\bfda\b/i, /approval/i, /merger|acquisition|acquire|buyout/i, /bankrupt/i, /\bceo\b/i,
  /resign/i, /\bbeat|beats|miss|misses\b/i, /cuts|raises|slash/i, /halt/i, /default/i, /layoff/i,
];

// Distinctive names per ticker so a catalyst headline must actually be ABOUT the company — this is
// what stops Yahoo's loosely-related search results (e.g. an AMD headline under "META") from
// firing a false catalyst. Generic words ("strategy") are deliberately omitted.
export const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple"], TSLA: ["tesla"], NVDA: ["nvidia"], MSFT: ["microsoft"], GOOGL: ["google", "alphabet"],
  AMZN: ["amazon"], META: ["meta platforms", "facebook", "instagram"], SPY: ["s&p 500", "spdr"],
  QQQ: ["nasdaq 100", "invesco qqq"], SQQQ: ["ultrapro short qqq"], TQQQ: ["ultrapro qqq"],
  PLTR: ["palantir"], CRCL: ["circle internet", "circle (crcl)"], HOOD: ["robinhood"], MSTR: ["microstrategy"],
  ORCL: ["oracle"], NFLX: ["netflix"], BABA: ["alibaba"], GME: ["gamestop"],
};

/** Match terms to use for a ticker: the symbol itself + its distinctive names. */
export function aliasesFor(ticker: string): string[] {
  const t = ticker.toUpperCase();
  return [t, ...(COMPANY_ALIASES[t] ?? [])];
}

/** Does the headline actually mention the company? Word-boundary for plain tokens, substring otherwise. */
function mentions(title: string, aliases: string[]): boolean {
  return aliases.some((a) => {
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = /^[a-z0-9]+$/i.test(a) ? new RegExp(`\\b${esc}\\b`, "i") : new RegExp(esc, "i");
    return re.test(title);
  });
}

export interface NewsCatalyst {
  fresh: boolean; // a catalyst headline ABOUT this company within the window
  count: number; // recent headlines in window (any)
  relevantCount: number; // recent headlines that actually mention the company
  matched: string[]; // catalyst headlines about the company (up to 3)
  latestTitle: string | null;
  summary: string;
}

/**
 * LOOK-AHEAD-SAFE + RELEVANCE-FILTERED. Only headlines with `cutoff <= publishedAt <= nowMs` count,
 * and a catalyst must (a) mention the company (`aliases`) and (b) hit a catalyst keyword.
 */
export function newsCatalyst(
  items: NewsItem[],
  aliases: string[],
  nowMs: number = Date.now(),
  withinHours = 24
): NewsCatalyst {
  const cutoff = nowMs - withinHours * 3600 * 1000;
  const recent = items
    .filter((n) => n.publishedAt > 0 && n.publishedAt <= nowMs && n.publishedAt >= cutoff)
    .sort((a, b) => b.publishedAt - a.publishedAt);
  const relevant = recent.filter((n) => mentions(n.title, aliases));
  const matched = relevant.filter((n) => CATALYST.some((r) => r.test(n.title)));
  const fresh = matched.length > 0;
  return {
    fresh,
    count: recent.length,
    relevantCount: relevant.length,
    matched: matched.slice(0, 3).map((m) => m.title),
    latestTitle: relevant.length ? relevant[0]!.title : null,
    summary: fresh
      ? `catalyst: "${matched[0]!.title}"`
      : relevant.length
        ? `${relevant.length} headline(s) about ${aliases[0]}, no clear catalyst`
        : "no relevant recent news",
  };
}
