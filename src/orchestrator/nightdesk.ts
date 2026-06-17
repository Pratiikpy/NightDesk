// NightDesk orchestrator: drives one full convergence loop over a sequence of snapshots —
// perception → council → gates → BitSim execution → ledger → auto-grade. Runs in replay
// (offline, deterministic) or live mode. This is the complete loop, no human in the middle.
import { quotesFromSnapshot } from "../bitsim/market";
import { BitSim } from "../bitsim/engine";
import { Account } from "../bitsim/account";
import { quoteFill } from "../bitsim/fills";
import type { Order, MarketQuote } from "../bitsim/types";
import { basisEventCards } from "../perception/eventcard";
import { runCouncil, type CouncilContext, type TradeProposal } from "../council/council";
import type { LLMProvider } from "../llm/provider";
import { MockLLMProvider } from "../llm/mock";
import { preTradeGates, type Proposal as GateProposal, type PreTradeCtx } from "../gates/gates";
import { Ledger, type CycleRecord } from "../ledger/ledger";
import { buildScorecard, summarizeJudgment, type Scorecard, type JudgmentSummary } from "../ledger/scorecard";
import { ConvergenceMemory, premiumBucket } from "../memory/convergence";
import { type EventContextProvider, NullEventProvider } from "../perception/events";
import { sessionFor } from "./session";
import type { Snapshot } from "../pegwatch/collect";

export interface SimOptions {
  llm?: LLMProvider;
  startCash?: number;
  accountId?: string;
  eventProvider?: EventContextProvider; // perception/abstention; default = NullEventProvider (offline)
  allowShorts?: boolean; // default false: long-only fades (buy cheap rTokens). Rich rTokens aren't
  // cleanly shortable (rToken spot can't be shorted; the perp proxy diverges from the rToken gap),
  // so by default the desk WATCHES rich dislocations instead of trading them. Set true to also short.
  gradeAtOpen?: boolean; // grade open positions at the first NYSE-open/RTH snapshot (where off-hours
  // dislocations actually resolve), not the last snapshot. Falls back to last if no open is in range.
}
export interface SimResult {
  ledger: Ledger;
  scorecard: Scorecard;
  equityStart: number;
  equityEnd: number;
  judgment: JudgmentSummary;
  gradedAtOpen: boolean;
}

function grossPctOf(acct: Account, marks: Map<string, number>, equity: number): number {
  if (equity <= 0) return 0;
  let gross = 0;
  for (const [s, p] of acct.spot) {
    const m = marks.get(s);
    if (m != null) gross += Math.abs(p.units * m);
  }
  for (const [s, p] of acct.perp) {
    const m = marks.get(s);
    if (m != null) gross += Math.abs(p.qty * m);
  }
  return (gross / equity) * 100;
}

interface OpenPos {
  rec: CycleRecord;
  symbol: string;
  kind: "spot" | "perp";
  side: "buy" | "sell";
  qty: number;
  entryPrice: number;
  entryPremium: number; // the gap (vs-equity if available, else vs-perp) at entry
  gapKind: "equity" | "perp";
}

export async function runSimulation(snapshots: Snapshot[], opts: SimOptions = {}): Promise<SimResult> {
  const llm = opts.llm ?? simCouncilProvider();
  const startCash = opts.startCash ?? 100_000;
  const accId = opts.accountId ?? "nightdesk";
  const sim = new BitSim();
  const acct = sim.createAccount(accId, startCash);
  const ledger = new Ledger();
  const memory = ConvergenceMemory.load(); // persistent across runs — the desk accumulates context
  const events = opts.eventProvider ?? new NullEventProvider(); // perception/abstention
  const allowShorts = opts.allowShorts ?? false; // long-only fades by default (soundness)
  const open = new Map<string, OpenPos>();
  // Counterfactual grading: what the avoided (abstained/gated) trades WOULD have done.
  const counterfactuals: { rec: CycleRecord; side: "buy" | "sell"; kind: "spot" | "perp"; entryPrice: number; entryPremium: number; gapKind: "equity" | "perp" }[] = [];
  let counter = 0;

  for (const snap of snapshots) {
    const quotes = quotesFromSnapshot(snap);
    sim.onMarket(quotes);
    const sess = sessionFor(snap.ts);
    if (!sess.newTradesAllowed) continue;

    for (const card of basisEventCards(snap)) {
      const ticker = card.tickers[0];
      if (open.has(ticker)) continue;
      const row = snap.rows.find((r) => r.ticker === ticker);
      if (!row) continue;
      const long = card.directionHint === "long";
      const kind: "spot" | "perp" = long ? "spot" : "perp";
      const leg = long ? row.rToken : row.perp;
      const price = leg?.mid ?? null;
      if (!leg || price == null || price <= 0) continue;
      // The gap this card trades — the true vs-equity gap when available, else the perp basis.
      const entryGap = Number(card.meta?.gapPct ?? row.premiumPct ?? 0);
      const gapKind = (card.meta?.gapKind as "equity" | "perp") ?? "perp";

      // Long-only soundness: a rich rToken (positive gap → "short") isn't cleanly shortable (no rToken
      // borrow; the perp proxy diverges from the rToken-vs-real gap we grade). Watch it, don't trade.
      if (!long && !allowShorts) {
        ledger.add({
          cycleId: `${ticker}-${snap.ts}-${counter++}`,
          ts: snap.ts,
          phase: sess.phase,
          ticker,
          card,
          transcript: [],
          proposal: {
            decision: "NO_TRADE",
            ticker,
            instrument: kind,
            side: "sell",
            sizePct: 0,
            expectedEdgePct: 0,
            expectedHorizonMin: 0,
            isBasisArb: false,
            thesis: `watch: rich rToken (+${entryGap.toFixed(2)}% gap) — not cleanly shortable on a long-only desk`,
            eventRef: card.eventId,
          },
          fills: [],
          outcome: "no_trade",
          usage: { promptTokens: 0, completionTokens: 0 },
        });
        continue;
      }

      // Event-aware abstention: if a fresh ticker catalyst or a high-severity macro window makes
      // this gap likely REAL (not a fade-able liquidity dislocation), the desk stands down.
      const pctx = await events.contextFor(ticker, snap.ts);
      if (pctx.abstainRecommended) {
        const arec: CycleRecord = {
          cycleId: `${ticker}-${snap.ts}-${counter++}`,
          ts: snap.ts,
          phase: sess.phase,
          ticker,
          card,
          transcript: [],
          proposal: {
            decision: "NO_TRADE",
            ticker,
            instrument: kind,
            side: "buy",
            sizePct: 0,
            expectedEdgePct: 0,
            expectedHorizonMin: 0,
            isBasisArb: false,
            thesis: `abstained — event window: ${pctx.summary}`,
            eventRef: card.eventId,
          },
          fills: [],
          outcome: "abstained",
          usage: { promptTokens: 0, completionTokens: 0 },
        };
        ledger.add(arec);
        counterfactuals.push({ rec: arec, side: long ? "buy" : "sell", kind, entryPrice: price, entryPremium: entryGap, gapKind });
        continue;
      }

      const prior = memory.recall(ticker, premiumBucket(entryGap), snap.ts);
      const ctx: CouncilContext = {
        ticker,
        instrument: kind,
        price,
        fairValue: gapKind === "equity" ? row.equity?.price ?? undefined : row.perp?.mid ?? undefined,
        premiumPct: entryGap,
        pegState: (card.meta?.depegState as string | undefined) ?? row.state ?? undefined,
        notes: `gap=${gapKind} hasBook=${(row.rToken?.bookLevels ?? 0) > 0}`,
        memoryPrior: pctx.severity !== "none" ? `${prior.summary} || EVENTS: ${pctx.summary}` : prior.summary,
      };
      const council = await runCouncil(llm, card, ctx);
      const base = {
        cycleId: `${ticker}-${snap.ts}-${counter++}`,
        ts: snap.ts,
        phase: sess.phase,
        ticker,
        card,
        transcript: council.transcript,
        proposal: council.proposal,
        fills: [],
        usage: council.usage,
      };

      if (council.proposal.decision !== "TRADE") {
        ledger.add({ ...base, outcome: "no_trade" });
        continue;
      }

      const marks = sim.marksFrom(quotes);
      const equity = acct.equity(marks);
      const sizePct = council.proposal.sizePct;
      const qtyRaw = (equity * (sizePct / 100)) / price;
      const q = quotes.get(leg.symbol)!;
      const estSlip = Math.abs(quoteFill(council.proposal.side, qtyRaw, q).slippagePct);

      const gateProposal: GateProposal = {
        ticker,
        instrument: kind,
        side: council.proposal.side,
        sizePct,
        expectedEdgePct: council.proposal.expectedEdgePct,
        effectiveLeverage: 1,
        stop: council.proposal.stop,
        isBasisArb: true,
      };
      const preCtx: PreTradeCtx = {
        existingTickerPct: 0,
        grossPct: grossPctOf(acct, marks, equity),
        pegState: row.state ?? null,
        estSlippagePct: estSlip,
        eventConfidence: card.confidence,
        numericGroundingPassed: true,
        correlatedOpenCount: 0,
        feeRoundTripPct: 0.32,
        dataAgeSec: 0,
        killSwitch: false,
        estVolPct: Math.max(1, Math.abs(entryGap)), // expected move proxy for parametric VaR
        anchorDeviationPct: Math.abs(row.premiumVsEquityPct ?? 0), // oracle sanity (absurd ⇒ bad print)
      };
      const gateReport = preTradeGates(gateProposal, preCtx);
      if (!gateReport.passed) {
        const grec: CycleRecord = { ...base, gateReport, outcome: "gated" };
        ledger.add(grec);
        counterfactuals.push({ rec: grec, side: council.proposal.side, kind, entryPrice: price, entryPremium: entryGap, gapKind });
        continue;
      }

      const order: Order = {
        id: base.cycleId,
        accountId: accId,
        symbol: leg.symbol,
        kind,
        side: council.proposal.side,
        type: "market",
        qty: qtyRaw,
        leverage: 1,
        ts: snap.ts,
      };
      const fill = sim.submit(order, q);
      const rec: CycleRecord = {
        ...base,
        gateReport,
        fills: [fill],
        symbol: leg.symbol,
        side: council.proposal.side,
        qty: fill.qty,
        entryPrice: fill.avgPrice ?? price,
        entryPremiumPct: entryGap,
        outcome: "flat",
      };
      ledger.add(rec);
      if ((fill.status === "filled" || fill.status === "partial") && fill.avgPrice != null) {
        open.set(ticker, {
          rec,
          symbol: leg.symbol,
          kind,
          side: council.proposal.side,
          qty: fill.qty,
          entryPrice: fill.avgPrice,
          entryPremium: entryGap,
          gapKind,
        });
      }
    }
  }

  // Grade: flat-by-open — close everything and score convergence. By default at the final snapshot;
  // with gradeAtOpen, at the first NYSE-open/RTH snapshot (where off-hours dislocations resolve).
  const last = snapshots[snapshots.length - 1];
  const openSnap = opts.gradeAtOpen
    ? snapshots.find((s) => { const ph = sessionFor(s.ts).phase; return ph === "STAND_DOWN" || ph === "PRE_OPEN"; })
    : undefined;
  const gradeSnap = openSnap ?? last;
  const gradedAtOpen = !!openSnap;
  if (gradeSnap) {
    const lastQuotes = quotesFromSnapshot(gradeSnap);
    for (const [ticker, pos] of open) {
      const row = gradeSnap.rows.find((r) => r.ticker === ticker);
      const exitLeg = pos.kind === "spot" ? row?.rToken : row?.perp;
      const exitPrice = exitLeg?.mid ?? pos.entryPrice;
      const closeSide = pos.side === "buy" ? "sell" : "buy";
      const q = lastQuotes.get(pos.symbol);
      if (q) {
        const closeOrder: Order = {
          id: `${pos.rec.cycleId}-close`,
          accountId: accId,
          symbol: pos.symbol,
          kind: pos.kind,
          side: closeSide,
          type: "market",
          qty: pos.qty,
          leverage: 1,
          ts: gradeSnap.ts,
        };
        sim.submit(closeOrder, q);
      }
      const dir = pos.side === "buy" ? 1 : -1;
      const pnl = dir * pos.qty * (exitPrice - pos.entryPrice);
      const exitGap = (pos.gapKind === "equity" ? row?.premiumVsEquityPct : row?.premiumPct) ?? pos.entryPremium;
      pos.rec.exitPrice = exitPrice;
      pos.rec.exitPremiumPct = exitGap;
      pos.rec.gradePnl = Number(pnl.toFixed(4));
      pos.rec.convergenceCaptured = Math.abs(exitGap) < Math.abs(pos.entryPremium);
      pos.rec.outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : "flat";
      // Reflection: write the graded outcome back to memory so future councils learn from it.
      memory.add({
        ticker,
        ts: gradeSnap.ts,
        bucket: premiumBucket(pos.entryPremium),
        premiumPct: pos.entryPremium,
        converged: pos.rec.convergenceCaptured,
        narrowingPp: Number((Math.abs(pos.entryPremium) - Math.abs(exitGap)).toFixed(4)),
        pnlPct: Number((Math.abs(pos.entryPremium) - Math.abs(exitGap)).toFixed(4)),
        holdBars: 0,
      });
    }
  }
  memory.save();

  // Counterfactual grading: how would the avoided (abstained/gated) trades have turned out?
  if (gradeSnap) {
    for (const cf of counterfactuals) {
      const r = gradeSnap.rows.find((x) => x.ticker === cf.rec.ticker);
      const exitLeg = cf.kind === "spot" ? r?.rToken : r?.perp;
      const exitPrice = exitLeg?.mid ?? cf.entryPrice;
      const exitGap = (cf.gapKind === "equity" ? r?.premiumVsEquityPct : r?.premiumPct) ?? cf.entryPremium;
      const dir = cf.side === "buy" ? 1 : -1;
      const wouldBePnlPct = cf.entryPrice > 0 ? Number((((dir * (exitPrice - cf.entryPrice)) / cf.entryPrice) * 100).toFixed(4)) : 0;
      const wouldHaveConverged = Math.abs(exitGap) < Math.abs(cf.entryPremium);
      // Abstaining/blocking was RIGHT if the avoided trade would not have converged (no missed edge).
      cf.rec.counterfactual = { wouldBePnlPct, wouldHaveConverged, decisionWasRight: !wouldHaveConverged };
    }
  }

  const judgment = summarizeJudgment(ledger.records);

  const equityEnd = gradeSnap ? acct.equity(sim.marksFrom(quotesFromSnapshot(gradeSnap))) : startCash;
  return { ledger, scorecard: buildScorecard(ledger.records), equityStart: startCash, equityEnd, judgment, gradedAtOpen };
}

/** Offline, deterministic council: prose roles return canned text; the PORTFOLIO_MANAGER emits the
 *  JSON decision derived from the brief. Routes on the [ROLE:NAME] tag in the system prompt. */
export function simCouncilProvider(): MockLLMProvider {
  return new MockLLMProvider((messages) => {
    const sys = messages.find((m) => m.role === "system")?.content ?? "";
    const role = /\[ROLE:(\w+)\]/.exec(sys)?.[1] ?? "";
    if (role !== "PORTFOLIO_MANAGER") {
      switch (role) {
        case "BULL":
          return "Premium gap vs fair value is real; expect convergence.";
        case "BEAR":
          return "Funding/liquidity risk exists but is bounded.";
        case "RESEARCH_MANAGER":
          return "Net stance: take the convergence; conviction 0.6.";
        case "RISK_AGGRESSIVE":
          return "Edge clears the fee floor; modest size up is justified.";
        case "RISK_CONSERVATIVE":
          return "Thin rToken books and funding risk — keep size small.";
        case "RISK_NEUTRAL":
          return "Balanced: take it at standard conservative size.";
        default:
          return "noted.";
      }
    }
    // PORTFOLIO_MANAGER → JSON decision derived from the brief.
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const dir = /Direction hint:\s*(long|short)/i.exec(user)?.[1]?.toLowerCase() ?? "long";
    const mag = Number(/magnitude\s*([\d.]+)/i.exec(user)?.[1] ?? "0.5");
    const price = Number(/Price:\s*([\d.]+)/i.exec(user)?.[1] ?? "100");
    const side = dir === "long" ? "buy" : "sell";
    const stop = side === "buy" ? price * 0.98 : price * 1.02;
    const tp = side === "buy" ? price * 1.02 : price * 0.98;
    return JSON.stringify({
      decision: "TRADE",
      side,
      instrument: dir === "long" ? "spot" : "perp",
      sizePct: 4,
      stop: Number(stop.toFixed(2)),
      takeProfit: Number(tp.toFixed(2)),
      expectedEdgePct: mag,
      expectedHorizonMin: 120,
      isBasisArb: true,
      pConverge: Number(Math.min(0.95, 0.5 + mag * 0.1).toFixed(2)),
      thesis: `${side} ${dir} convergence on ${mag.toFixed(2)}% premium`,
    });
  });
}
