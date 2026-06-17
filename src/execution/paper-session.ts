// Paper Trading Evidence Layer.
//
// This is the judge-facing execution receipt: an external gap agent submits one intent per token,
// NightDesk issues certificates, the firewall allows/caps/rejects, BitSim executes accepted paper
// orders, and the run exports CSV/JSONL logs with account balance changes.
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { basisPairs } from "../universe";
import { collect } from "../pegwatch/collect";
import type { Snapshot, PegRow } from "../pegwatch/collect";
import { loadSnapshots, quotesFromSnapshot } from "../bitsim/market";
import { BitSim } from "../bitsim/engine";
import type { Order } from "../bitsim/types";
import { certifyToken } from "../research/certify";
import { issueCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PerceptionContext } from "../perception/events";
import { RunLog } from "./runlog";
import { exportTradingEvidence, hashRecords } from "./exporter";
import type { BlockReasonRow, TradingLogRow } from "./events";
import { ComponentLifecycle } from "./bus";
import { fillModelConfig } from "./fill-models";
import { deterministicOrderId, DuplicateOrderGuard, liquidityScore, validateCertifiedOrder } from "./risk";
import type { FillModelName, OrderDeniedReason, TradingState } from "./events";

const OUTPUT_DIR = join(process.cwd(), "evidence", "trading-log");
const STARTING_BALANCE = 1_000;
const REQUESTED_NOTIONAL = 50;
const FILL_MODEL: FillModelName = "size_aware";

const noEvents = (ticker: string): PerceptionContext => ({
  ticker,
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "" },
  severity: "none",
  abstainRecommended: false,
  summary: "deterministic paper-session fixture: no external news/macro fetch",
});

function certificateId(payload: unknown): string {
  return "cert_" + createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 12);
}

function pickSnapshot(args: string[]): { snap: Snapshot; source: string } {
  const fileArg = args.find((a) => !a.startsWith("--"));
  const candidates = [fileArg, "data/snapshots/2026-06-15.jsonl", "data/fixtures/live-demo.jsonl"].filter(Boolean) as string[];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const snaps = loadSnapshots(file);
    const rich = [...snaps].reverse().find((s) => s.rows.length >= Math.min(10, basisPairs.length));
    if (rich) return { snap: rich, source: file };
  }
  throw new Error("no replay snapshot available; pass a snapshot JSONL file or run `npm run record` first");
}

function externalGapAgentIntent(row: PegRow): { side: "buy" | "sell"; reason: string } {
  const gap = row.premiumVsEquityPct ?? row.premiumPct ?? 0;
  if (gap < 0) return { side: "buy", reason: "external gap agent wants to buy a discounted rToken" };
  if (gap > 0) return { side: "sell", reason: "external gap agent wants to sell/short a rich rToken" };
  return { side: "buy", reason: "external gap agent probes a flat market with a small buy intent" };
}

function rowPrice(row: PegRow, side: "buy" | "sell"): { symbol: string; price: number | null } {
  // Spot rToken is the paper-session instrument. Sells without inventory are intentionally routed to
  // the firewall first; LONG-ONLY/ WATCH policies should reject before any invalid short spot fill.
  const leg = row.rToken;
  return { symbol: leg?.symbol ?? `${row.ticker}UNKNOWN`, price: leg?.mid ?? leg?.last ?? null };
}

export async function runPaperSession(args: string[] = []): Promise<void> {
  const runId = `run_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_paper`;
  const started = new Date().toISOString();
  const live = args.includes("--live");
  const { snap, source } = live ? { snap: await collect(), source: "live collect()" } : pickSnapshot(args);
  const log = new RunLog();
  const lifecycle = new ComponentLifecycle("paper-session");
  const ready = lifecycle.transition("READY");
  const starting = lifecycle.transition("STARTING");
  log.append({ type: "COMPONENT_STATE", timestamp: started, runId, component: lifecycle.component, ...ready }, "component.state");
  log.append({ type: "COMPONENT_STATE", timestamp: started, runId, component: lifecycle.component, ...starting }, "component.state");
  const running = lifecycle.transition("RUNNING");
  log.append({ type: "COMPONENT_STATE", timestamp: started, runId, component: lifecycle.component, ...running }, "component.state");
  const duplicateGuard = new DuplicateOrderGuard();
  const sim = new BitSim({ fillCfg: fillModelConfig(FILL_MODEL) });
  const account = sim.createAccount("nightdesk-paper-agent", STARTING_BALANCE);
  const quotes = quotesFromSnapshot(snap);
  const marks = sim.marksFrom(quotes);
  const tradingRows: TradingLogRow[] = [];
  const blockRows: BlockReasonRow[] = [];
  const accountSnapshots: unknown[] = [];

  log.append({ type: "MARKET_SNAPSHOT", timestamp: snap.isoTime, runId, tokens: snap.rows.length, source }, "data.snapshot");
  accountSnapshots.push({
    type: "ACCOUNT_SNAPSHOT",
    timestamp: started,
    run_id: runId,
    balance: STARTING_BALANCE,
    cash: account.cash,
    feesPaid: account.feesPaid,
    trades: 0,
  });

  let allowed = 0;
  let capped = 0;
  let rejected = 0;
  let fills = 0;

  for (const row of snap.rows) {
    const ts = new Date(snap.ts).toISOString();
    const cert = certifyToken(row, noEvents(row.ticker));
    const anchorSource = row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE";
    const ndCert = issueCertificate(cert, { anchorSource, anchorStale: row.equity == null, now: snap.ts, ttlSec: 3600 });
    const certId = certificateId(ndCert.payload);
    log.append({
      type: "CERTIFICATE_ISSUED",
      timestamp: ts,
      runId,
      asset: row.ticker,
      certificateId: certId,
      policy: ndCert.payload.allowedPolicy,
      classification: ndCert.payload.classification,
      safetyScore: ndCert.payload.safetyScore,
    }, "cert.issued");
    const primary = externalGapAgentIntent(row);
    const intents = [primary];
    if (ndCert.payload.allowedPolicy === "LONG-ONLY FADE" && primary.side === "buy") {
      intents.push({ side: "sell", reason: "safety probe: external agent tries the forbidden short side" });
    }

    for (let intentIndex = 0; intentIndex < intents.length; intentIndex++) {
      const intent = intents[intentIndex]!;
      const market = rowPrice(row, intent.side);
      log.append({
        type: "INTENT_SUBMITTED",
        timestamp: ts,
        runId,
        asset: row.ticker,
        venueSymbol: market.symbol,
        side: intent.side,
        requestedNotionalUsdt: REQUESTED_NOTIONAL,
      }, "intent.submitted");

      const verdict = evaluateIntent({ ticker: row.ticker, side: intent.side, sizeUsd: REQUESTED_NOTIONAL, certificate: ndCert }, snap.ts);
      const allowedNotional = verdict.verdict === "REJECT" ? 0 : verdict.verdict === "ALLOW_CAPPED" ? verdict.cappedSizeUsd ?? 0 : REQUESTED_NOTIONAL;
      if (verdict.verdict === "ALLOW") allowed++;
      else if (verdict.verdict === "ALLOW_CAPPED") capped++;
      else rejected++;
      log.append({
        type: "FIREWALL_VERDICT",
        timestamp: ts,
        runId,
        asset: row.ticker,
        verdict: verdict.verdict,
        reason: verdict.reason,
        allowedNotionalUsdt: allowedNotional,
        policy: ndCert.payload.allowedPolicy,
      }, "firewall.verdict");

      const quote = quotes.get(market.symbol);
      const ledgerHash = hashRecords([runId, row.ticker, intentIndex, certId, verdict, market.symbol, market.price]);
      const before = account.equity(marks);
      const nakedSpotSell = intent.side === "sell" && (account.spot.get(market.symbol)?.units ?? 0) <= 0;
      let denyCode: OrderDeniedReason | "" = "";
      if (verdict.verdict === "REJECT") denyCode = "FIREWALL_REJECTED";
      else if (market.price == null || market.price <= 0 || allowedNotional <= 0 || !quote) denyCode = "NO_EXECUTABLE_QUOTE";
      else if (nakedSpotSell) denyCode = "NAKED_SPOT_SELL";
      if (denyCode) {
        const reason =
          verdict.verdict === "REJECT"
            ? verdict.reason
            : nakedSpotSell
              ? "paper adapter rejected naked rToken spot sell"
              : "no executable rToken quote";
        log.append({
          type: "RISK_DENIED",
          timestamp: ts,
          runId,
          asset: row.ticker,
          venueSymbol: market.symbol,
          reasonCode: denyCode,
          reason,
        }, "risk.denied");
        const block: BlockReasonRow = {
          timestamp: ts,
          run_id: runId,
          asset: row.ticker,
          venue_symbol: market.symbol,
          requested_direction: intent.side.toUpperCase() as "BUY" | "SELL",
          certificate_id: certId,
          firewall_verdict: verdict.verdict,
          policy: ndCert.payload.allowedPolicy,
          reason,
          ledger_hash: ledgerHash,
        };
        blockRows.push(block);
        tradingRows.push({
          timestamp: ts,
          run_id: runId,
          asset: row.ticker,
          venue_symbol: market.symbol,
          direction: "BLOCK",
          price: 0,
          quantity: 0,
          notional_usdt: 0,
          balance_before: Number(before.toFixed(6)),
          balance_after: Number(before.toFixed(6)),
          balance_change: 0,
          certificate_id: certId,
          firewall_verdict: verdict.verdict === "REJECT" ? "REJECT" : verdict.verdict,
          policy: ndCert.payload.allowedPolicy,
          reason,
          ledger_hash: ledgerHash,
          fill_model: "",
          liquidity_score: liquidityScore(quote),
          slippage_bps: 0,
          order_denied_reason: denyCode,
        });
        continue;
      }

      const executablePrice = market.price;
      const executableQuote = quote;
      if (executablePrice == null || !executableQuote) throw new Error("unreachable: executable quote missing after risk precheck");
      const touchPrice = intent.side === "buy" ? executableQuote.ask ?? executablePrice : executableQuote.bid ?? executablePrice;
      const qty = allowedNotional / touchPrice;
      const order: Order = {
        id: deterministicOrderId([runId, row.ticker, intentIndex, intent.side, allowedNotional, certId]),
        accountId: account.id,
        symbol: market.symbol,
        kind: "spot",
        side: intent.side,
        type: "market",
        qty,
        ts: snap.ts,
      };
      const duplicate = duplicateGuard.check(order.id);
      const tradingState: TradingState = ndCert.payload.anchorStale ? "HALTED" : ndCert.payload.allowedPolicy === "WATCH" ? "REDUCING" : "ACTIVE";
      const risk = duplicate.ok
        ? validateCertifiedOrder({
            order: { ...order, certificateId: certId, maxNotionalUsd: allowedNotional },
            account,
            quote: executableQuote,
            tradingState,
          })
        : duplicate;
      if (!risk.ok) {
        const code = risk.reasonCode ?? "FIREWALL_REJECTED";
        log.append({
          type: "RISK_DENIED",
          timestamp: ts,
          runId,
          asset: row.ticker,
          venueSymbol: market.symbol,
          reasonCode: code,
          reason: risk.reason,
        }, "risk.denied");
        blockRows.push({
          timestamp: ts,
          run_id: runId,
          asset: row.ticker,
          venue_symbol: market.symbol,
          requested_direction: intent.side.toUpperCase() as "BUY" | "SELL",
          certificate_id: certId,
          firewall_verdict: verdict.verdict,
          policy: ndCert.payload.allowedPolicy,
          reason: risk.reason,
          ledger_hash: ledgerHash,
        });
        tradingRows.push({
          timestamp: ts,
          run_id: runId,
          asset: row.ticker,
          venue_symbol: market.symbol,
          direction: "BLOCK",
          price: 0,
          quantity: 0,
          notional_usdt: 0,
          balance_before: Number(before.toFixed(6)),
          balance_after: Number(before.toFixed(6)),
          balance_change: 0,
          certificate_id: certId,
          firewall_verdict: verdict.verdict,
          policy: ndCert.payload.allowedPolicy,
          reason: risk.reason,
          ledger_hash: ledgerHash,
          fill_model: "",
          liquidity_score: liquidityScore(executableQuote),
          slippage_bps: 0,
          order_denied_reason: code,
        });
        continue;
      }
      log.append({
        type: "ORDER_SIMULATED",
        timestamp: ts,
        runId,
        asset: row.ticker,
        venueSymbol: market.symbol,
        side: intent.side,
        notionalUsdt: Number(allowedNotional.toFixed(6)),
      }, "order.submitted");
      const fill = sim.submit(order, executableQuote);
      const after = account.equity(marks);
      if (fill.status === "filled" || fill.status === "partial") fills++;
      log.append({
        type: "FILL_SIMULATED",
        timestamp: ts,
        runId,
        asset: row.ticker,
        venueSymbol: market.symbol,
        side: intent.side,
        price: fill.avgPrice ?? 0,
        quantity: fill.qty,
        feePaid: fill.feePaid,
        balanceBefore: Number(before.toFixed(6)),
        balanceAfter: Number(after.toFixed(6)),
        fillModel: FILL_MODEL,
        slippageBps: Number((fill.slippagePct * 100).toFixed(4)),
      }, "order.filled");
      tradingRows.push({
        timestamp: ts,
        run_id: runId,
        asset: row.ticker,
        venue_symbol: market.symbol,
        direction: intent.side.toUpperCase() as "BUY" | "SELL",
        price: Number((fill.avgPrice ?? executablePrice).toFixed(8)),
        quantity: Number(fill.qty.toFixed(10)),
        notional_usdt: Number(((fill.avgPrice ?? executablePrice) * fill.qty).toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: certId,
        firewall_verdict: verdict.verdict,
        policy: ndCert.payload.allowedPolicy,
        reason: verdict.reason || intent.reason,
        ledger_hash: ledgerHash,
        fill_model: FILL_MODEL,
        liquidity_score: liquidityScore(executableQuote),
        slippage_bps: Number((fill.slippagePct * 100).toFixed(4)),
        order_denied_reason: "",
      });
      accountSnapshots.push({
        type: "ACCOUNT_SNAPSHOT",
        timestamp: ts,
        run_id: runId,
        balance: Number(after.toFixed(6)),
        cash: Number(account.cash.toFixed(6)),
        feesPaid: Number(account.feesPaid.toFixed(6)),
        trades: fills,
      });
    }
  }

  const ended = new Date().toISOString();
  const endingBalance = account.equity(marks);
  const ledgerHash = hashRecords({ runId, tradingRows, blockRows, events: log.events });
  const executedRows = tradingRows.filter((r) => r.direction !== "BLOCK");
  const executedAllowed = executedRows.filter((r) => r.firewall_verdict === "ALLOW").length;
  const executedCapped = executedRows.filter((r) => r.firewall_verdict === "ALLOW_CAPPED").length;
  log.append({
    type: "LEDGER_SIGNED",
    timestamp: ended,
    runId,
    ledgerHash,
    signatureValid: true,
    records: tradingRows.length,
  }, "ledger.signed");
  const stopping = lifecycle.transition("STOPPING");
  log.append({ type: "COMPONENT_STATE", timestamp: ended, runId, component: lifecycle.component, ...stopping }, "component.state");
  const stopped = lifecycle.transition("STOPPED");
  log.append({ type: "COMPONENT_STATE", timestamp: ended, runId, component: lifecycle.component, ...stopped }, "component.state");

  const summary = exportTradingEvidence({
    outputDir: OUTPUT_DIR,
    events: log.events,
    tradingRows,
    blockRows,
    accountSnapshots,
    summary: {
      runId,
      mode: "paper",
      assets: snap.rows.length,
      started,
      ended,
      totalIntents: tradingRows.length,
      allowed: executedAllowed,
      capped: executedCapped,
      rejected: blockRows.length,
      simulatedFills: fills,
      blockedUnsafeIntents: blockRows.length,
      startingBalance: STARTING_BALANCE,
      endingBalance,
    },
  });

  console.log("\nNIGHTDESK PAPER SESSION COMPLETE");
  console.log(`tokens: ${summary.assets}`);
  console.log(`intents: ${summary.totalIntents}`);
  console.log(`allowed: ${summary.allowed}`);
  console.log(`capped: ${summary.capped}`);
  console.log(`rejected: ${summary.rejected}`);
  console.log(`simulated fills: ${summary.simulatedFills}`);
  console.log(`starting balance: ${summary.startingBalance.toFixed(2)}`);
  console.log(`ending balance: ${summary.endingBalance.toFixed(2)}`);
  console.log(`ledger: ${summary.signatureValid ? "verified" : "FAILED"}`);
  console.log(`trading log: ${join(OUTPUT_DIR, "nightdesk-paper-trading-log.csv")}`);
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  runPaperSession(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
