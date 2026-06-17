// Perception context = the event-aware ABSTENTION decision for one ticker at one moment.
// It fuses the macro calendar (SoSoValue) and per-ticker news (Yahoo) into a single judgement:
// "is this dislocation likely real (news/macro-driven → stand down) or fade-able (quiet → trade)?"
//
// The council reads `summary` (so it reasons over the why), and the orchestrator reads
// `abstainRecommended` for a deterministic stand-down. Providers keep the loop offline+deterministic
// by default (NullEventProvider); the live MarketEventProvider hits the real feeds.
import { fetchMacroEvents, macroWindowFor, type MacroEvent, type MacroWindow } from "./macro";
import { fetchTickerNews, newsCatalyst, aliasesFor, type NewsCatalyst } from "./news";

export interface PerceptionContext {
  ticker: string;
  macro: MacroWindow;
  news: NewsCatalyst;
  severity: "high" | "medium" | "low" | "none";
  abstainRecommended: boolean;
  summary: string;
}

/** Pure fusion of a macro window + a news catalyst into the abstention decision. */
export function buildPerceptionContext(ticker: string, macro: MacroWindow, news: NewsCatalyst): PerceptionContext {
  // Stand down when the gap is likely REAL: a fresh ticker catalyst, or a high-severity macro day.
  const abstainRecommended = news.fresh || macro.active;
  const severity = news.fresh || macro.active ? "high" : macro.severity === "medium" ? "medium" : "none";
  const parts = [macro.active ? `MACRO ${macro.summary}` : null, news.fresh ? `NEWS ${news.summary}` : null].filter(Boolean);
  return {
    ticker,
    macro,
    news,
    severity,
    abstainRecommended,
    summary: parts.length ? parts.join(" | ") : "no significant macro/news events",
  };
}

const emptyMacro: MacroWindow = { active: false, date: "", events: [], severity: "low", summary: "" };
const emptyNews: NewsCatalyst = { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "no recent news" };

export interface EventContextProvider {
  readonly name: string;
  contextFor(ticker: string, nowMs: number): Promise<PerceptionContext>;
}

/** Default: no events, never abstain. Keeps replay/sim/tests offline and deterministic. */
export class NullEventProvider implements EventContextProvider {
  readonly name = "null";
  async contextFor(ticker: string): Promise<PerceptionContext> {
    return buildPerceptionContext(ticker, emptyMacro, emptyNews);
  }
}

/** Live: SoSoValue macro calendar (cached) + Yahoo per-ticker news. */
export class MarketEventProvider implements EventContextProvider {
  readonly name = "market";
  private macro: MacroEvent[] = [];
  private macroAt = 0;

  async contextFor(ticker: string, nowMs: number = Date.now()): Promise<PerceptionContext> {
    if (nowMs - this.macroAt > 1_800_000) {
      this.macro = await fetchMacroEvents();
      this.macroAt = nowMs;
    }
    const macro = macroWindowFor(this.macro, nowMs);
    const news = newsCatalyst(await fetchTickerNews(ticker), aliasesFor(ticker), nowMs);
    return buildPerceptionContext(ticker, macro, news);
  }
}
