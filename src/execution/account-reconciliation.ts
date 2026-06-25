import { Account, type FeeConfig } from "../bitsim/account";
import type { Side } from "../bitsim/types";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

export type AccountEvent =
  | { sequence: number; id: string; accountId: string; ts: number; type: "ACCOUNT_OPENED"; cash: number; fees: FeeConfig }
  | { sequence: number; id: string; accountId: string; ts: number; type: "SPOT_FILL"; symbol: string; side: Side; qty: number; price: number }
  | { sequence: number; id: string; accountId: string; ts: number; type: "PERP_FILL"; symbol: string; side: Side; qty: number; price: number; leverage: number }
  | { sequence: number; id: string; accountId: string; ts: number; type: "FUNDING"; symbol: string; rate: number; mark: number };

export interface AccountSnapshot {
  accountId: string;
  cash: number;
  realizedPnl: number;
  feesPaid: number;
  fundingPaid: number;
  spot: Array<{ symbol: string; units: number; avgCost: number }>;
  perp: Array<{ symbol: string; qty: number; entry: number; leverage: number }>;
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`invalid ${label}`);
}

export function snapshotAccount(account: Account): AccountSnapshot {
  return {
    accountId: account.id,
    cash: account.cash,
    realizedPnl: account.realizedPnl,
    feesPaid: account.feesPaid,
    fundingPaid: account.fundingPaid,
    spot: [...account.spot.entries()].map(([symbol, position]) => ({ symbol, ...position })).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    perp: [...account.perp.entries()].map(([symbol, position]) => ({ symbol, ...position })).sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

export class AccountJournal {
  readonly events: AccountEvent[] = [];
  private ids = new Set<string>();
  private readonly filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    if (filePath && existsSync(filePath)) {
      const records = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const record of records) this.record(JSON.parse(record) as AccountEvent, false);
    }
  }

  append(event: AccountEvent): void {
    this.record(event, true);
  }

  private record(event: AccountEvent, persist: boolean): void {
    if (this.ids.has(event.id)) throw new Error(`duplicate account event id: ${event.id}`);
    const accountEvents = this.events.filter((candidate) => candidate.accountId === event.accountId);
    if (event.sequence !== accountEvents.length + 1) throw new Error(`account event sequence gap: expected ${accountEvents.length + 1}, got ${event.sequence}`);
    if (accountEvents.length > 0 && event.ts < accountEvents[accountEvents.length - 1]!.ts) throw new Error("account event timestamp regression");
    this.events.push(structuredClone(event));
    this.ids.add(event.id);
    if (persist && this.filePath) appendFileSync(this.filePath, JSON.stringify(event) + "\n");
  }

  forAccount(accountId: string): AccountEvent[] {
    return this.events.filter((event) => event.accountId === accountId).map((event) => structuredClone(event));
  }

  static replay(events: AccountEvent[]): Account {
    if (events.length === 0 || events[0]!.type !== "ACCOUNT_OPENED") throw new Error("account journal must start with ACCOUNT_OPENED");
    const accountId = events[0]!.accountId;
    const opened = events[0];
    finite(opened.cash, "opening cash");
    const account = new Account(accountId, opened.cash, opened.fees);
    let previousSequence = 0;
    let previousTs = Number.NEGATIVE_INFINITY;
    const ids = new Set<string>();
    for (const event of events) {
      if (event.accountId !== accountId) throw new Error("mixed account journal");
      if (event.sequence !== previousSequence + 1) throw new Error("account event sequence gap");
      if (event.ts < previousTs) throw new Error("account event timestamp regression");
      if (ids.has(event.id)) throw new Error("duplicate account event id");
      previousSequence = event.sequence;
      previousTs = event.ts;
      ids.add(event.id);
      if (event.type === "ACCOUNT_OPENED") {
        if (event.sequence !== 1) throw new Error("duplicate ACCOUNT_OPENED");
      } else if (event.type === "SPOT_FILL") {
        finite(event.qty, "spot quantity");
        finite(event.price, "spot price");
        account.applySpotFill(event.symbol, event.side, event.qty, event.price);
      } else if (event.type === "PERP_FILL") {
        finite(event.qty, "perp quantity");
        finite(event.price, "perp price");
        account.applyPerpFill(event.symbol, event.side, event.qty, event.price, event.leverage);
      } else {
        finite(event.rate, "funding rate");
        finite(event.mark, "funding mark");
        account.applyFunding(event.symbol, event.rate, event.mark);
      }
    }
    return account;
  }

  toJsonl(): string {
    return this.events.map((event) => JSON.stringify(event)).join("\n") + (this.events.length ? "\n" : "");
  }
}

export function reconcileAccount(actual: Account, events: AccountEvent[], tolerance = 1e-9): { ok: boolean; differences: string[] } {
  const rebuilt = AccountJournal.replay(events);
  const left = snapshotAccount(actual);
  const right = snapshotAccount(rebuilt);
  const differences: string[] = [];
  for (const field of ["cash", "realizedPnl", "feesPaid", "fundingPaid"] as const) {
    if (Math.abs(left[field] - right[field]) > tolerance) differences.push(`${field}: actual=${left[field]} replay=${right[field]}`);
  }
  if (JSON.stringify(left.spot) !== JSON.stringify(right.spot)) differences.push("spot positions differ");
  if (JSON.stringify(left.perp) !== JSON.stringify(right.perp)) differences.push("perp positions differ");
  return { ok: differences.length === 0, differences };
}
