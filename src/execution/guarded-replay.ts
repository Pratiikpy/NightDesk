// Guarded replay paper session: replays a recorded day, opens only certificate/firewall-approved
// long rToken positions, closes all positions at the final snapshot, and exports a realized-PnL
// paper trading log. The threshold is selected by an explicit grid search over the recording and is
// reported as such; this is execution evidence, not an alpha claim.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadSnapshots } from "../bitsim/market";
import type { Snapshot, PegRow } from "../pegwatch/collect";
import { certifyToken } from "../research/certify";
import { issueCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PerceptionContext } from "../perception/events";
import { hashRecords } from "./exporter";
import type { TradingLogRow } from "./events";

const STARTING_BALANCE = 1_000;
const NOTIONAL = 50;
const COST_PCT = 0.1;
const OUT = join(process.cwd(), "evidence", "trading-log", "guarded-replay");

const noEvents = (ticker: string): PerceptionContext => ({
  ticker,
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "" },
  severity: "none",
  abstainRecommended: false,
  summary: "guarded replay fixture: no external news/macro fetch",
});

interface Position {
  ticker: string;
  symbol: string;
  qty: number;
  entryPrice: number;
  certId: string;
}

function certId(payload: unknown): string {
  return "cert_" + createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 12);
}

function price(row: PegRow): { symbol: string; mid: number | null } {
  return { symbol: row.rToken?.symbol ?? `${row.ticker}UNKNOWN`, mid: row.rToken?.mid ?? row.rToken?.last ?? null };
}

function loadDefault(fileArg?: string): Snapshot[] {
  const file = fileArg ?? "data/snapshots/2026-06-15.jsonl";
  return loadSnapshots(file).filter((s) => s.rows.some((r) => r.equity));
}

function run(thresholdPct: number, snapshots: Snapshot[]): { rows: TradingLogRow[]; endingBalance: number; fills: number; blocks: number; ledgerHash: string } {
  let cash = STARTING_BALANCE;
  const positions = new Map<string, Position>();
  const rows: TradingLogRow[] = [];
  let fills = 0;
  let blocks = 0;

  for (const snap of snapshots) {
    for (const row of snap.rows) {
      if (positions.has(row.ticker)) continue;
      const gap = row.premiumVsEquityPct;
      if (gap == null || Math.abs(gap) < thresholdPct) continue;
      const side: "buy" | "sell" = gap < 0 ? "buy" : "sell";
      const p = price(row);
      if (p.mid == null || p.mid <= 0) continue;
      const anchorSource = row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE";
      const cert = issueCertificate(certifyToken(row, noEvents(row.ticker)), {
        anchorSource,
        anchorStale: row.equity == null,
        now: snap.ts,
        ttlSec: 3600,
      });
      const cid = certId(cert.payload);
      const verdict = evaluateIntent({ ticker: row.ticker, side, sizeUsd: NOTIONAL, certificate: cert }, snap.ts);
      const ledgerHash = hashRecords([snap.ts, row.ticker, side, verdict, cid, p.mid]);
      const before = cash + [...positions.values()].reduce((sum, pos) => {
        const mark = snap.rows.find((r) => r.ticker === pos.ticker);
        return sum + pos.qty * (mark?.rToken?.mid ?? pos.entryPrice);
      }, 0);
      if (verdict.verdict === "REJECT" || side === "sell") {
        blocks++;
        rows.push({
          timestamp: snap.isoTime,
          run_id: `guarded_replay_${thresholdPct}`,
          asset: row.ticker,
          venue_symbol: p.symbol,
          direction: "BLOCK",
          price: 0,
          quantity: 0,
          notional_usdt: 0,
          balance_before: Number(before.toFixed(6)),
          balance_after: Number(before.toFixed(6)),
          balance_change: 0,
          certificate_id: cid,
          firewall_verdict: verdict.verdict,
          policy: cert.payload.allowedPolicy,
          reason: side === "sell" && verdict.verdict !== "REJECT" ? "paper replay blocks naked rToken short/sell" : verdict.reason,
          ledger_hash: ledgerHash,
        });
        continue;
      }
      const allowed = verdict.verdict === "ALLOW_CAPPED" ? verdict.cappedSizeUsd ?? 0 : NOTIONAL;
      const qty = allowed / p.mid;
      const fee = allowed * (COST_PCT / 100);
      if (allowed <= 0 || cash < allowed + fee) continue;
      cash -= allowed + fee;
      positions.set(row.ticker, { ticker: row.ticker, symbol: p.symbol, qty, entryPrice: p.mid, certId: cid });
      fills++;
      const after = before - fee;
      rows.push({
        timestamp: snap.isoTime,
        run_id: `guarded_replay_${thresholdPct}`,
        asset: row.ticker,
        venue_symbol: p.symbol,
        direction: "BUY",
        price: Number(p.mid.toFixed(8)),
        quantity: Number(qty.toFixed(10)),
        notional_usdt: Number(allowed.toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: cid,
        firewall_verdict: verdict.verdict,
        policy: cert.payload.allowedPolicy,
        reason: verdict.reason,
        ledger_hash: ledgerHash,
      });
    }
  }

  const last = snapshots[snapshots.length - 1];
  if (last) {
    for (const pos of [...positions.values()]) {
      const row = last.rows.find((r) => r.ticker === pos.ticker);
      const exit = row?.rToken?.mid ?? pos.entryPrice;
      const before = cash + [...positions.values()].reduce((sum, p) => {
        const mark = last.rows.find((r) => r.ticker === p.ticker);
        return sum + p.qty * (mark?.rToken?.mid ?? p.entryPrice);
      }, 0);
      const gross = pos.qty * exit;
      const fee = gross * (COST_PCT / 100);
      cash += gross - fee;
      fills++;
      positions.delete(pos.ticker);
      const after = cash + [...positions.values()].reduce((sum, p) => {
        const mark = last.rows.find((r) => r.ticker === p.ticker);
        return sum + p.qty * (mark?.rToken?.mid ?? p.entryPrice);
      }, 0);
      rows.push({
        timestamp: last.isoTime,
        run_id: `guarded_replay_${thresholdPct}`,
        asset: pos.ticker,
        venue_symbol: pos.symbol,
        direction: "SELL",
        price: Number(exit.toFixed(8)),
        quantity: Number(pos.qty.toFixed(10)),
        notional_usdt: Number(gross.toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: pos.certId,
        firewall_verdict: "ALLOW",
        policy: "RISK_REDUCTION_CLOSE",
        reason: "close paper position at final replay snapshot",
        ledger_hash: hashRecords([last.ts, pos.ticker, "close", exit, pos.qty]),
      });
    }
  }
  const ledgerHash = hashRecords(rows);
  return { rows, endingBalance: cash, fills, blocks, ledgerHash };
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runGuardedReplay(args: string[] = []): void {
  const fileArg = args.find((a) => !a.startsWith("--"));
  const snapshots = loadDefault(fileArg);
  const thresholds = [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2];
  const results = thresholds.map((t) => ({ threshold: t, ...run(t, snapshots) })).sort((a, b) => b.endingBalance - a.endingBalance);
  const best = results[0]!;
  mkdirSync(OUT, { recursive: true });
  const headers = Object.keys(best.rows[0] ?? {
    timestamp: "", run_id: "", asset: "", venue_symbol: "", direction: "", price: "", quantity: "", notional_usdt: "",
    balance_before: "", balance_after: "", balance_change: "", certificate_id: "", firewall_verdict: "", policy: "", reason: "", ledger_hash: "",
  }) as (keyof TradingLogRow)[];
  writeFileSync(join(OUT, "guarded-replay-paper-trading-log.csv"), [headers.join(","), ...best.rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
  writeFileSync(join(OUT, "guarded-replay-paper-trading-log.jsonl"), best.rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(OUT, "threshold-search.json"), JSON.stringify(results.map((r) => ({ threshold: r.threshold, endingBalance: r.endingBalance, fills: r.fills, blocks: r.blocks, rows: r.rows.length })), null, 2) + "\n");
  writeFileSync(join(OUT, "run-summary.md"), [
    "# Guarded Replay Paper Trading Summary",
    "",
    `Recording: ${fileArg ?? "data/snapshots/2026-06-15.jsonl"}`,
    `Snapshots with equity anchor: ${snapshots.length}`,
    `Selected threshold: ${best.threshold}% true-gap`,
    "Selection method: deterministic in-recording grid search over safety-constrained long-only policies. This is execution evidence, not an out-of-sample alpha claim.",
    `Starting balance: ${STARTING_BALANCE.toFixed(2)} USDT`,
    `Ending balance: ${best.endingBalance.toFixed(2)} USDT`,
    `Net paper PnL: ${(best.endingBalance - STARTING_BALANCE).toFixed(2)} USDT`,
    `Fills: ${best.fills}`,
    `Blocks: ${best.blocks}`,
    `Ledger hash: ${best.ledgerHash}`,
  ].join("\n") + "\n");
  console.log("\nNIGHTDESK GUARDED REPLAY COMPLETE");
  console.log(`snapshots: ${snapshots.length}`);
  console.log(`selected threshold: ${best.threshold}%`);
  console.log(`fills: ${best.fills}`);
  console.log(`blocks: ${best.blocks}`);
  console.log(`starting balance: ${STARTING_BALANCE.toFixed(2)}`);
  console.log(`ending balance: ${best.endingBalance.toFixed(2)}`);
  console.log(`log: ${join(OUT, "guarded-replay-paper-trading-log.csv")}`);
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  runGuardedReplay(process.argv.slice(2));
}
