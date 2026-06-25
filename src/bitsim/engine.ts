// BitSim engine: routes orders to quote- or depth-fills, applies them to accounts,
// supports resting limit orders checked on each market update, funding, and marks.
import type { Fill, MarketQuote, Order, Side } from "./types";
import { Account, type FeeConfig, DEFAULT_FEES } from "./account";
import { quoteFill, depthFill, DEFAULT_FILL, type FillModelConfig } from "./fills";
import { validateVenueOrder, type VenueRules } from "../execution/venue-rules";
import { AccountJournal, reconcileAccount } from "../execution/account-reconciliation";
import { applyAggressorTrade, createQueuePosition, type QueuePosition } from "../execution/queue-position";

interface PendingOrder {
  order: Order;
  remainingQty: number;
  queue?: QueuePosition;
}

export class BitSim {
  accounts = new Map<string, Account>();
  fills: Fill[] = [];
  pending: PendingOrder[] = [];
  private fillCfg: FillModelConfig;
  private fees: FeeConfig;
  private venueRules: Record<string, VenueRules>;
  readonly accountJournal: AccountJournal;

  constructor(opts: { fillCfg?: FillModelConfig; fees?: FeeConfig; venueRules?: Record<string, VenueRules>; journalPath?: string } = {}) {
    this.fillCfg = opts.fillCfg ?? DEFAULT_FILL;
    this.fees = opts.fees ?? DEFAULT_FEES;
    this.venueRules = opts.venueRules ?? {};
    this.accountJournal = new AccountJournal(opts.journalPath);
    const recoveredAccounts = new Set(this.accountJournal.events.map((event) => event.accountId));
    for (const accountId of recoveredAccounts) {
      const account = AccountJournal.replay(this.accountJournal.forAccount(accountId));
      this.accounts.set(accountId, account);
    }
  }

  createAccount(id: string, cash: number): Account {
    if (this.accounts.has(id)) throw new Error(`account already exists: ${id}`);
    const a = new Account(id, cash, this.fees);
    this.accounts.set(id, a);
    this.accountJournal.append({ sequence: 1, id: `account:${id}:opened`, accountId: id, ts: 0, type: "ACCOUNT_OPENED", cash, fees: this.fees });
    return a;
  }

  private reject(o: Order, reason: string): Fill {
    const f: Fill = {
      orderId: o.id,
      accountId: o.accountId,
      symbol: o.symbol,
      kind: o.kind,
      side: o.side,
      qty: 0,
      avgPrice: null,
      feePaid: 0,
      slippagePct: 0,
      ts: o.ts,
      status: "rejected",
      reason,
    };
    this.fills.push(f);
    return f;
  }

  private queueFor(o: Order, q: MarketQuote, remainingQty: number): QueuePosition | undefined {
    if (o.limitPrice == null || !(remainingQty > 0)) return undefined;
    const tolerance = Math.max(1, Math.abs(o.limitPrice)) * 1e-12;
    const atTouch = o.side === "buy"
      ? q.bid != null && Math.abs(o.limitPrice - q.bid) <= tolerance
      : q.ask != null && Math.abs(o.limitPrice - q.ask) <= tolerance;
    const aheadQty = atTouch ? (o.side === "buy" ? q.bidSz : q.askSz) ?? 0 : 0;
    return createQueuePosition(o.id, o.side, o.limitPrice, remainingQty, Math.max(0, aheadQty));
  }

  private execute(o: Order, q: MarketQuote, priceCap?: number): Fill {
    const acct = this.accounts.get(o.accountId);
    if (!acct) return this.reject(o, "no such account");

    const useDepth = o.kind === "perp" && q.book && q.book.bids.length > 0 && q.book.asks.length > 0;
    const res = useDepth
      ? depthFill(o.side, o.qty, q.book!, priceCap)
      : quoteFill(o.side, o.qty, q, priceCap == null ? this.fillCfg : { ...this.fillCfg, baseSlipPct: 0, impactPct: 0 });
    if (res.avgPrice == null || res.fillQty <= 0) return this.reject(o, "no liquidity");

    const price = res.avgPrice;
    if (priceCap != null && (o.side === "buy" ? price > priceCap : price < priceCap)) {
      return this.reject(o, "limit price violated");
    }

    if (o.kind === "spot" && o.side === "sell") {
      const held = acct.spot.get(o.symbol)?.units ?? 0;
      if (res.fillQty > held + 1e-12) return this.reject(o, "insufficient spot position");
    }
    if (o.kind === "spot" && o.side === "buy") {
      const estimatedCost = res.fillQty * price * (1 + this.fees.spotTakerPct / 100);
      if (estimatedCost > acct.cash + 1e-12) return this.reject(o, "insufficient cash");
    }

    const fee =
      o.kind === "spot"
        ? acct.applySpotFill(o.symbol, o.side, res.fillQty, price)
        : acct.applyPerpFill(o.symbol, o.side, res.fillQty, price, o.leverage ?? 1);
    const accountSequence = this.accountJournal.forAccount(o.accountId).length + 1;
    this.accountJournal.append(o.kind === "spot"
      ? { sequence: accountSequence, id: `fill:${o.id}:${this.fills.length}`, accountId: o.accountId, ts: o.ts, type: "SPOT_FILL", symbol: o.symbol, side: o.side, qty: res.fillQty, price }
      : { sequence: accountSequence, id: `fill:${o.id}:${this.fills.length}`, accountId: o.accountId, ts: o.ts, type: "PERP_FILL", symbol: o.symbol, side: o.side, qty: res.fillQty, price, leverage: o.leverage ?? 1 });

    const f: Fill = {
      orderId: o.id,
      accountId: o.accountId,
      symbol: o.symbol,
      kind: o.kind,
      side: o.side,
      qty: res.fillQty,
      avgPrice: price,
      feePaid: fee,
      slippagePct: res.slippagePct,
      ts: o.ts,
      status: res.fillQty >= o.qty - 1e-12 ? "filled" : "partial",
    };
    this.fills.push(f);
    return f;
  }

  /** Submit an order against the current market quote for its symbol. */
  submit(o: Order, q: MarketQuote): Fill {
    const referencePrice = o.limitPrice ?? (o.side === "buy" ? q.ask : q.bid) ?? q.last ?? NaN;
    if (!Number.isFinite(o.qty) || !(o.qty > 0) || !Number.isFinite(referencePrice) || !(referencePrice > 0)) {
      return this.reject(o, "invalid order numbers");
    }
    const rules = this.venueRules[o.symbol];
    if (rules) {
      const validation = validateVenueOrder(o, referencePrice, rules);
      if (!validation.ok) return this.reject(o, `venue reject: ${validation.reason}`);
    }
    if (o.type === "market") return this.execute(o, q);
    // limit
    const touch = o.side === "buy" ? q.ask : q.bid;
    const marketable = touch != null && o.limitPrice != null && (o.side === "buy" ? touch <= o.limitPrice : touch >= o.limitPrice);
    if (marketable) {
      const fill = this.execute(o, q, o.limitPrice);
      if (fill.status === "partial") {
        const remainingQty = o.qty - fill.qty;
        this.pending.push({ order: { ...o, qty: remainingQty }, remainingQty, queue: this.queueFor(o, q, remainingQty) });
      }
      return fill;
    }
    // rest it
    this.pending.push({ order: { ...o }, remainingQty: o.qty, queue: this.queueFor(o, q, o.qty) });
    const f: Fill = {
      orderId: o.id,
      accountId: o.accountId,
      symbol: o.symbol,
      kind: o.kind,
      side: o.side,
      qty: 0,
      avgPrice: null,
      feePaid: 0,
      slippagePct: 0,
      ts: o.ts,
      status: "pending",
    };
    return f;
  }

  /** Feed fresh quotes: settles any marketable resting limit orders. Returns new fills. */
  onMarket(quotes: Map<string, MarketQuote>): Fill[] {
    const stillPending: PendingOrder[] = [];
    const newFills: Fill[] = [];
    for (const pending of this.pending) {
      const o = { ...pending.order, qty: pending.remainingQty };
      const q = quotes.get(o.symbol);
      const touch = q ? (o.side === "buy" ? q.ask : q.bid) : null;
      const marketable = q && touch != null && o.limitPrice != null && (o.side === "buy" ? touch <= o.limitPrice : touch >= o.limitPrice);
      if (marketable) {
        const fill = this.execute(o, q!, o.limitPrice);
        newFills.push(fill);
        const remainder = pending.remainingQty - fill.qty;
        if (fill.status === "partial" && remainder > 1e-12) {
          stillPending.push({ order: { ...pending.order, qty: remainder }, remainingQty: remainder });
        }
      } else if (pending.queue && q?.last != null && q.lastTradeSide && q.lastTradeQty != null && q.lastTradeQty > 0) {
        const queueResult = applyAggressorTrade(pending.queue, { side: q.lastTradeSide, price: q.last, qty: q.lastTradeQty });
        if (queueResult.fillQty > 0) {
          const syntheticQuote: MarketQuote = o.side === "buy"
            ? { symbol: o.symbol, bid: o.limitPrice!, ask: o.limitPrice!, last: o.limitPrice!, askSz: queueResult.fillQty }
            : { symbol: o.symbol, bid: o.limitPrice!, ask: o.limitPrice!, last: o.limitPrice!, bidSz: queueResult.fillQty };
          const fill = this.execute({ ...o, qty: queueResult.fillQty }, syntheticQuote, o.limitPrice);
          if (queueResult.position.remainingQty > 1e-12) fill.status = "partial";
          newFills.push(fill);
        }
        if (queueResult.position.remainingQty > 1e-12) {
          stillPending.push({ order: { ...pending.order, qty: queueResult.position.remainingQty }, remainingQty: queueResult.position.remainingQty, queue: queueResult.position });
        }
      } else stillPending.push(pending);
    }
    this.pending = stillPending;
    return newFills;
  }

  /** Apply funding to all open perp positions from the quotes' fundingRate. */
  applyFunding(quotes: Map<string, MarketQuote>): void {
    for (const acct of this.accounts.values()) {
      for (const [symbol, pos] of acct.perp) {
        const q = quotes.get(symbol);
        if (q?.fundingRate != null && q.last != null && pos.qty !== 0) {
          acct.applyFunding(symbol, q.fundingRate, q.last);
          const accountSequence = this.accountJournal.forAccount(acct.id).length + 1;
          this.accountJournal.append({ sequence: accountSequence, id: `funding:${acct.id}:${symbol}:${accountSequence}`, accountId: acct.id, ts: Date.now(), type: "FUNDING", symbol, rate: q.fundingRate, mark: q.last });
        }
      }
    }
  }

  marksFrom(quotes: Map<string, MarketQuote>): Map<string, number> {
    const marks = new Map<string, number>();
    for (const [sym, q] of quotes) {
      const m = q.last ?? (q.bid != null && q.ask != null ? (q.bid + q.ask) / 2 : null);
      if (m != null) marks.set(sym, m);
    }
    return marks;
  }

  reconcile(accountId: string): { ok: boolean; differences: string[] } {
    const account = this.accounts.get(accountId);
    if (!account) return { ok: false, differences: ["account missing"] };
    return reconcileAccount(account, this.accountJournal.forAccount(accountId));
  }
}
