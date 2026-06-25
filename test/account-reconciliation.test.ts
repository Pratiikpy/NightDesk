import { test } from "node:test";
import assert from "node:assert/strict";
import { BitSim } from "../src/bitsim/engine";
import { AccountJournal, reconcileAccount } from "../src/execution/account-reconciliation";
import type { MarketQuote, Order } from "../src/bitsim/types";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("paper account reconstructs exactly from its append-only execution events", () => {
  const sim = new BitSim();
  const account = sim.createAccount("a", 10_000);
  const quote: MarketQuote = { symbol: "RAAPLUSDT", bid: 99, ask: 100, last: 99.5 };
  const buy: Order = { id: "buy", accountId: "a", symbol: quote.symbol, kind: "spot", side: "buy", type: "market", qty: 2, ts: 1 };
  const sell: Order = { ...buy, id: "sell", side: "sell", qty: 1, ts: 2 };
  sim.submit(buy, quote);
  sim.submit(sell, quote);
  const result = sim.reconcile("a");
  assert.equal(result.ok, true, result.differences.join("; "));
  const rebuilt = AccountJournal.replay(sim.accountJournal.forAccount("a"));
  assert.equal(rebuilt.cash, account.cash);
  assert.equal(rebuilt.spot.get(quote.symbol)!.units, 1);
});

test("reconciliation detects mutated account state", () => {
  const sim = new BitSim();
  const account = sim.createAccount("a", 1_000);
  account.cash += 10;
  const result = reconcileAccount(account, sim.accountJournal.forAccount("a"));
  assert.equal(result.ok, false);
  assert.match(result.differences.join(" "), /cash/);
});

test("account journal rejects duplicate ids, sequence gaps, and timestamp regressions", () => {
  const journal = new AccountJournal();
  const opened = { sequence: 1, id: "open", accountId: "a", ts: 10, type: "ACCOUNT_OPENED" as const, cash: 100, fees: { spotTakerPct: 0.1, perpTakerPct: 0.06 } };
  journal.append(opened);
  assert.throws(() => journal.append(opened), /duplicate/);
  assert.throws(() => journal.append({ sequence: 3, id: "gap", accountId: "a", ts: 11, type: "SPOT_FILL", symbol: "X", side: "buy", qty: 1, price: 10 }), /sequence gap/);
  assert.throws(() => journal.append({ sequence: 2, id: "old", accountId: "a", ts: 9, type: "SPOT_FILL", symbol: "X", side: "buy", qty: 1, price: 10 }), /timestamp regression/);
});

test("BitSim restores account state exactly from a durable journal after restart", () => {
  const journalPath = join(mkdtempSync(join(tmpdir(), "nightdesk-account-")), "events.jsonl");
  const first = new BitSim({ journalPath });
  first.createAccount("a", 1_000);
  const quote: MarketQuote = { symbol: "RAAPLUSDT", bid: 99, ask: 100, last: 100 };
  first.submit({ id: "buy", accountId: "a", symbol: quote.symbol, kind: "spot", side: "buy", type: "market", qty: 2, ts: 1 }, quote);

  const recovered = new BitSim({ journalPath });
  assert.equal(recovered.accounts.get("a")!.cash, first.accounts.get("a")!.cash);
  assert.equal(recovered.accounts.get("a")!.spot.get(quote.symbol)!.units, 2);
  assert.equal(recovered.reconcile("a").ok, true);
  assert.throws(() => recovered.createAccount("a", 1_000), /already exists/);
});
