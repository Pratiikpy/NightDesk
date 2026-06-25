import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BitSim } from "../bitsim/engine";
import { depthFill } from "../bitsim/fills";
import type { MarketQuote, Order } from "../bitsim/types";
import { implementationShortfall } from "./implementation-shortfall";
import { OrderLifecycle } from "./order-state-machine";
import { applyAggressorTrade, createQueuePosition } from "./queue-position";
import { replayExecution, type ExecutionReplayEvent } from "./depth-replay";

const OUT = join(process.cwd(), "evidence", "execution-v2");

interface ProofRow {
  requirement: string;
  passed: boolean;
  detail: string;
}

export function runExecutionV2Proof(): { passed: boolean; rows: ProofRow[] } {
  mkdirSync(OUT, { recursive: true });
  const rows: ProofRow[] = [];

  const limited = depthFill("buy", 4, { asks: [[100, 2], [101, 5]], bids: [] }, 100);
  rows.push({ requirement: "limit protection", passed: limited.fillQty === 2 && limited.avgPrice === 100, detail: `${limited.fillQty} units filled at ${limited.avgPrice}; worse level excluded` });

  const sim = new BitSim({ venueRules: { RAAPLUSDT: { tickSize: 0.1, lotSize: 0.01, minQty: 0.01, minNotional: 5 } } });
  const account = sim.createAccount("proof", 10_000);
  const order: Order = { id: "partial", accountId: account.id, symbol: "RAAPLUSDT", kind: "spot", side: "buy", type: "limit", qty: 5, limitPrice: 100, ts: 1 };
  const firstQuote: MarketQuote = { symbol: order.symbol, bid: 99.9, ask: 100, last: 100, askSz: 2 };
  const first = sim.submit(order, firstQuote);
  rows.push({ requirement: "partial fill remainder", passed: first.status === "partial" && first.qty === 2 && sim.pending[0]?.remainingQty === 3, detail: `filled=${first.qty}, resting=${sim.pending[0]?.remainingQty ?? 0}` });
  sim.onMarket(new Map([[order.symbol, { ...firstQuote, askSz: 3 }]]));

  const invalid = sim.submit({ ...order, id: "bad-tick", qty: 1, limitPrice: 100.05, ts: 2 }, firstQuote);
  rows.push({ requirement: "venue tick/lot/notional rules", passed: invalid.status === "rejected" && invalid.reason?.includes("PRICE_TICK") === true, detail: invalid.reason ?? "missing reason" });

  let queue = createQueuePosition("resting", "buy", 100, 5, 3);
  queue = applyAggressorTrade(queue, { side: "sell", price: 100, qty: 2 }).position;
  const queueResult = applyAggressorTrade(queue, { side: "sell", price: 100, qty: 4 });
  const queueSim = new BitSim();
  queueSim.createAccount("queue", 10_000);
  const queuedOrder: Order = { id: "queued", accountId: "queue", symbol: "RAAPLUSDT", kind: "spot", side: "buy", type: "limit", qty: 5, limitPrice: 99, ts: 1 };
  const restingQuote: MarketQuote = { symbol: queuedOrder.symbol, bid: 99, ask: 100, last: 99, bidSz: 3, askSz: 10 };
  queueSim.submit(queuedOrder, restingQuote);
  const beforeQueue = queueSim.onMarket(new Map([[queuedOrder.symbol, { ...restingQuote, lastTradeSide: "sell", lastTradeQty: 2 }]]));
  const afterQueue = queueSim.onMarket(new Map([[queuedOrder.symbol, { ...restingQuote, lastTradeSide: "sell", lastTradeQty: 4 }]]));
  rows.push({ requirement: "price-time queue position", passed: queueResult.fillQty === 3 && queueResult.position.remainingQty === 2 && beforeQueue.length === 0 && afterQueue[0]?.qty === 3 && queueSim.pending[0]?.remainingQty === 2, detail: `integrated_fill=${afterQueue[0]?.qty ?? 0}, remaining=${queueSim.pending[0]?.remainingQty ?? 0}` });

  const lifecycle = new OrderLifecycle(5).apply({ type: "Submit" }).apply({ type: "Accept" }).apply({ type: "CancelRequest" }).apply({ type: "Fill", fillQty: 2 }).apply({ type: "CancelAck" });
  rows.push({ requirement: "cancel/fill race", passed: lifecycle.status === "Canceled" && lifecycle.filledQty === 2, detail: `status=${lifecycle.status}, late_fill=${lifecycle.filledQty}` });

  const shortfall = implementationShortfall({ side: "buy", quantity: 10, decisionPrice: 100, arrivalPrice: 100.2, fillPrice: 100.3, fees: 1 });
  rows.push({ requirement: "implementation shortfall attribution", passed: Math.abs(shortfall.totalCost - 4) < 1e-9 && Math.abs(shortfall.totalBps - 40) < 1e-9, detail: `delay=${shortfall.delayCost}, execution=${shortfall.executionCost}, fees=${shortfall.fees}, total_bps=${shortfall.totalBps}` });

  const reconciliation = sim.reconcile(account.id);
  rows.push({ requirement: "event-sourced account reconciliation", passed: reconciliation.ok, detail: reconciliation.ok ? `${sim.accountJournal.forAccount(account.id).length} events replay exactly` : reconciliation.differences.join("; ") });
  account.cash += 1;
  const tampered = sim.reconcile(account.id);
  rows.push({ requirement: "account drift detection", passed: !tampered.ok && tampered.differences.some((difference) => difference.startsWith("cash:")), detail: tampered.differences.join("; ") });

  const durablePath = join(OUT, "durable-account-events.jsonl");
  if (existsSync(durablePath)) unlinkSync(durablePath);
  const beforeRestart = new BitSim({ journalPath: durablePath });
  beforeRestart.createAccount("durable", 1_000);
  beforeRestart.submit({ ...order, id: "durable-buy", accountId: "durable", qty: 1 }, firstQuote);
  const afterRestart = new BitSim({ journalPath: durablePath });
  const restored = afterRestart.accounts.get("durable");
  rows.push({ requirement: "durable crash recovery", passed: restored != null && afterRestart.reconcile("durable").ok && restored.cash === beforeRestart.accounts.get("durable")?.cash, detail: restored ? `${afterRestart.accountJournal.events.length} durable events restored exactly` : "account not restored" });

  const replayEvents: ExecutionReplayEvent[] = [
    { sequence: 1, ts: 1, type: "MARKET", quote: { symbol: "NVDAUSDT", bid: 99, ask: 100, last: 100, book: { bids: [[99, 5]], asks: [[100, 1], [101, 5]] } } },
    { sequence: 2, ts: 2, type: "ORDER", order: { id: "replay-limit", accountId: "replay", symbol: "NVDAUSDT", kind: "perp", side: "buy", type: "limit", qty: 3, limitPrice: 100, ts: 2 } },
    { sequence: 3, ts: 3, type: "MARKET", quote: { symbol: "NVDAUSDT", bid: 99, ask: 100, last: 100, book: { bids: [[99, 5]], asks: [[100, 2], [101, 5]] } } },
  ];
  const replayOne = replayExecution({ accounts: [{ id: "replay", cash: 1_000 }], events: replayEvents });
  const replayTwo = replayExecution({ accounts: [{ id: "replay", cash: 1_000 }], events: replayEvents });
  rows.push({ requirement: "deterministic depth event replay", passed: replayOne.fingerprint === replayTwo.fingerprint && replayOne.fills.length === 2 && replayOne.pending.length === 0, detail: `fingerprint=${replayOne.fingerprint.slice(0, 16)}, fills=${replayOne.fills.length}` });

  const payload = { schema: "nightdesk.execution-v2-proof.v1", generatedAt: new Date().toISOString(), passed: rows.every((row) => row.passed), rows, shortfall };
  writeFileSync(join(OUT, "execution-v2-proof.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(join(OUT, "account-events.jsonl"), sim.accountJournal.events.map((event) => JSON.stringify(event)).join("\n") + "\n");
  writeFileSync(join(OUT, "execution-v2-report.md"), [
    "# Execution Engine v2 Proof",
    "",
    `Overall: **${payload.passed ? "PASS" : "FAIL"}**`,
    "",
    "| Requirement | Result | Detail |",
    "|---|---:|---|",
    ...rows.map((row) => `| ${row.requirement} | ${row.passed ? "PASS" : "FAIL"} | ${row.detail} |`),
    "",
    "This deterministic proof covers execution semantics. Live order-book shadow calibration and liquidity-tier simulation error remain future work.",
  ].join("\n") + "\n");
  console.log(`NIGHTDESK EXECUTION V2 PROOF: ${payload.passed ? "PASS" : "FAIL"} (${rows.filter((row) => row.passed).length}/${rows.length})`);
  if (!payload.passed) process.exitCode = 1;
  return { passed: payload.passed, rows };
}

if (process.argv[1]?.endsWith("execution-v2-proof.ts")) runExecutionV2Proof();
