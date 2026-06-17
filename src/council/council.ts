// The bull/bear/risk-supervisor council (PRD §8.4). Event-scoped debate → TradeProposal | NO_TRADE.
// Supervisor has absolute veto. Transcript + token usage captured for the audit log.
import type { LLMProvider, LLMUsage } from "../llm/provider";
import { addUsage, emptyUsage } from "../llm/provider";
import type { EventCard } from "../perception/eventcard";
import { bullMessages, bearMessages, researchManagerMessages, riskDebatorMessages, portfolioManagerMessages, type CouncilContext } from "./prompts";

export type { CouncilContext } from "./prompts";

export interface TradeProposal {
  decision: "TRADE" | "NO_TRADE";
  ticker: string;
  instrument: "spot" | "perp";
  side: "buy" | "sell";
  sizePct: number;
  entryBand?: [number, number];
  stop?: number;
  takeProfit?: number;
  expectedEdgePct: number;
  expectedHorizonMin: number;
  isBasisArb: boolean;
  thesis: string;
  eventRef: string;
  pConverge?: number; // portfolio manager's calibrated probability the gap converges (0..1)
}
export interface CouncilResult {
  proposal: TradeProposal;
  transcript: { role: string; content: string }[];
  usage: LLMUsage;
}
export interface CouncilLimits {
  maxSizePct: number;
  maxLeverage: number;
}
export const DEFAULT_LIMITS: CouncilLimits = { maxSizePct: 10, maxLeverage: 3 };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function runCouncil(
  llm: LLMProvider,
  card: EventCard,
  ctx: CouncilContext,
  limits: CouncilLimits = DEFAULT_LIMITS
): Promise<CouncilResult> {
  let usage = emptyUsage();
  const transcript: { role: string; content: string }[] = [];
  const call = async (messages: ReturnType<typeof bullMessages>, role: string, temperature: number): Promise<string> => {
    const r = await llm.complete(messages, { temperature });
    usage = addUsage(usage, r.usage);
    transcript.push({ role, content: r.text });
    return r.text;
  };

  // Analyst debate → research synthesis → 3-way risk debate → portfolio-manager decision (with veto).
  const bull = await call(bullMessages(card, ctx), "bull", 0.4);
  const bear = await call(bearMessages(card, ctx, bull), "bear", 0.4);
  const research = await call(researchManagerMessages(card, ctx, bull, bear), "research_manager", 0.3);
  const aggressive = await call(riskDebatorMessages("AGGRESSIVE", card, ctx, research), "risk_aggressive", 0.4);
  const conservative = await call(riskDebatorMessages("CONSERVATIVE", card, ctx, research), "risk_conservative", 0.4);
  const neutral = await call(riskDebatorMessages("NEUTRAL", card, ctx, research), "risk_neutral", 0.3);
  const pm = await call(portfolioManagerMessages(card, ctx, research, { aggressive, conservative, neutral }), "portfolio_manager", 0.1);

  const proposal = parseProposal(pm, card, ctx, limits);
  return { proposal, transcript, usage };
}

function noTrade(ctx: CouncilContext, eventRef: string, thesis: string): TradeProposal {
  return {
    decision: "NO_TRADE",
    ticker: ctx.ticker,
    instrument: ctx.instrument,
    side: "buy",
    sizePct: 0,
    expectedEdgePct: 0,
    expectedHorizonMin: 0,
    isBasisArb: false,
    thesis,
    eventRef,
  };
}

function extractJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export function parseProposal(text: string, card: EventCard, ctx: CouncilContext, limits: CouncilLimits): TradeProposal {
  const j = extractJson(text);
  if (!j) return noTrade(ctx, card.eventId, "supervisor output unparseable → safe NO_TRADE");
  if (String(j.decision ?? "").toUpperCase() !== "TRADE") return noTrade(ctx, card.eventId, String(j.thesis ?? "supervisor declined"));

  const sizePct = clamp(Number(j.sizePct) || 0, 0, limits.maxSizePct);
  if (sizePct <= 0) return noTrade(ctx, card.eventId, "supervisor sized to zero");

  const instrument = j.instrument === "spot" || j.instrument === "perp" ? j.instrument : ctx.instrument;
  const entryBand =
    Array.isArray(j.entryBand) && j.entryBand.length === 2 ? ([Number(j.entryBand[0]), Number(j.entryBand[1])] as [number, number]) : undefined;

  return {
    decision: "TRADE",
    ticker: ctx.ticker,
    instrument,
    side: j.side === "sell" ? "sell" : "buy",
    sizePct,
    entryBand,
    stop: j.stop != null ? Number(j.stop) : undefined,
    takeProfit: j.takeProfit != null ? Number(j.takeProfit) : undefined,
    expectedEdgePct: Number(j.expectedEdgePct) || card.magnitudeEst || 0,
    expectedHorizonMin: Number(j.expectedHorizonMin) || card.halfLifeMin || 120,
    isBasisArb: j.isBasisArb != null ? !!j.isBasisArb : card.type === "basis",
    thesis: String(j.thesis ?? "").slice(0, 500),
    eventRef: card.eventId,
    pConverge: j.pConverge != null ? clamp(Number(j.pConverge) || 0, 0, 1) : undefined,
  };
}
