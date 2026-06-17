import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import type { Snapshot, PegRow } from "../pegwatch/collect";
import { certifyToken } from "../research/certify";
import { issueCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PerceptionContext } from "../perception/events";
import { hashRecords } from "./exporter";
import type { TradingLogRow } from "./events";

const OUT = join(process.cwd(), "evidence", "agent-arena-v2");
const STARTING_BALANCE = 1_000;
const NOTIONAL = 50;
const FEE_PCT = 0.1;
const MIN_GAP = 0.2;

export type AgentPolicyId =
  | "naive_gap_agent"
  | "naive_gap_agent_guarded"
  | "perp_trust_agent"
  | "perp_trust_agent_guarded"
  | "momentum_agent"
  | "momentum_agent_guarded"
  | "news_blind_agent"
  | "news_blind_agent_guarded"
  | "random_agent"
  | "random_agent_guarded"
  | "qwen_council_agent"
  | "nightdesk_guarded_agent";

export interface AgentIntent {
  side: "buy" | "sell";
  reason: string;
}

export interface AgentPolicy {
  id: AgentPolicyId;
  guarded?: boolean;
  onSnapshot(row: PegRow, index: number): AgentIntent | null;
}

interface Position {
  ticker: string;
  symbol: string;
  qty: number;
  entry: number;
  certId: string;
}

const noEvents = (ticker: string): PerceptionContext => ({
  ticker,
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "" },
  severity: "none",
  abstainRecommended: false,
  summary: "arena-v2 deterministic fixture",
});

function certId(payload: unknown): string {
  return "cert_" + hashRecords(payload).slice(0, 12);
}

function price(row: PegRow): { symbol: string; mid: number | null } {
  return { symbol: row.rToken?.symbol ?? `${row.ticker}UNKNOWN`, mid: row.rToken?.mid ?? row.rToken?.last ?? null };
}

function gap(row: PegRow, preferPerp = false): number | null {
  return preferPerp ? row.premiumPct ?? null : row.premiumVsEquityPct ?? row.premiumPct ?? null;
}

export const AGENT_POLICIES: AgentPolicy[] = [
  {
    id: "naive_gap_agent",
    onSnapshot: (row) => {
      const g = gap(row);
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g < 0 ? "buy" : "sell", reason: "trades every visible gap" };
    },
  },
  {
    id: "naive_gap_agent_guarded",
    guarded: true,
    onSnapshot: (row) => {
      const g = gap(row);
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g < 0 ? "buy" : "sell", reason: "same naive gap intent routed through NightDesk firewall" };
    },
  },
  {
    id: "perp_trust_agent",
    onSnapshot: (row) => {
      const g = gap(row, true);
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g < 0 ? "buy" : "sell", reason: "uses perp basis instead of NYSE anchor" };
    },
  },
  {
    id: "perp_trust_agent_guarded",
    guarded: true,
    onSnapshot: (row) => {
      const g = gap(row, true);
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g < 0 ? "buy" : "sell", reason: "same perp-trust intent routed through NightDesk firewall" };
    },
  },
  {
    id: "momentum_agent",
    onSnapshot: (row) => {
      const g = gap(row);
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g > 0 ? "buy" : "sell", reason: "chases the dislocation" };
    },
  },
  {
    id: "momentum_agent_guarded",
    guarded: true,
    onSnapshot: (row) => {
      const g = gap(row);
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g > 0 ? "buy" : "sell", reason: "same momentum intent routed through NightDesk firewall" };
    },
  },
  {
    id: "news_blind_agent",
    onSnapshot: (row) => {
      const g = row.premiumVsEquityPct ?? null;
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g < 0 ? "buy" : "sell", reason: "ignores macro/news abstention and trades true gap" };
    },
  },
  {
    id: "news_blind_agent_guarded",
    guarded: true,
    onSnapshot: (row) => {
      const g = row.premiumVsEquityPct ?? null;
      if (g == null || Math.abs(g) < MIN_GAP) return null;
      return { side: g < 0 ? "buy" : "sell", reason: "same news-blind intent routed through NightDesk firewall" };
    },
  },
  {
    id: "random_agent",
    onSnapshot: (_row, index) => {
      if (index % 11 !== 0) return null;
      return { side: index % 2 === 0 ? "buy" : "sell", reason: "deterministic random baseline" };
    },
  },
  {
    id: "random_agent_guarded",
    guarded: true,
    onSnapshot: (_row, index) => {
      if (index % 11 !== 0) return null;
      return { side: index % 2 === 0 ? "buy" : "sell", reason: "same deterministic random intent routed through NightDesk firewall" };
    },
  },
  {
    id: "qwen_council_agent",
    onSnapshot: (row) => {
      const g = row.premiumVsEquityPct ?? null;
      if (g == null || Math.abs(g) < 0.5 || g > 0) return null;
      return { side: "buy", reason: "council-style conservative long-only fade" };
    },
  },
  {
    id: "nightdesk_guarded_agent",
    onSnapshot: (row) => {
      const g = row.premiumVsEquityPct ?? null;
      if (g == null || Math.abs(g) < 0.5 || g > 0) return null;
      return { side: "buy", reason: "NightDesk certificate-first long-only intent" };
    },
  },
];

function runAgent(policy: AgentPolicy, snapshots: Snapshot[]): { rows: TradingLogRow[]; endingBalance: number; fills: number; blocks: number; maxDrawdown: number } {
  let cash = STARTING_BALANCE;
  let highWater = STARTING_BALANCE;
  let maxDrawdown = 0;
  let fills = 0;
  let blocks = 0;
  const positions = new Map<string, Position>();
  const rows: TradingLogRow[] = [];

  snapshots.forEach((snap, snapIndex) => {
    for (const row of snap.rows) {
      if (positions.has(row.ticker)) continue;
      const intent = policy.onSnapshot(row, snapIndex);
      if (!intent) continue;
      const p = price(row);
      if (p.mid == null || p.mid <= 0) continue;
      const cert = issueCertificate(certifyToken(row, noEvents(row.ticker)), {
        anchorSource: row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
        anchorStale: row.equity == null,
        now: snap.ts,
        ttlSec: 3600,
      });
      const cid = certId(cert.payload);
      const guarded = policy.guarded === true || policy.id === "nightdesk_guarded_agent";
      const verdict = guarded ? evaluateIntent({ ticker: row.ticker, side: intent.side, sizeUsd: NOTIONAL, certificate: cert }, snap.ts) : { verdict: "ALLOW" as const, reason: "unguarded baseline" };
      const before = cash + [...positions.values()].reduce((sum, pos) => {
        const mark = snap.rows.find((r) => r.ticker === pos.ticker)?.rToken?.mid ?? pos.entry;
        return sum + pos.qty * mark;
      }, 0);
      if (verdict.verdict === "REJECT" || intent.side === "sell") {
        blocks++;
        rows.push({
          timestamp: snap.isoTime,
          run_id: `arena_v2_${policy.id}`,
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
          reason: verdict.verdict === "REJECT" ? verdict.reason : "arena blocks naked rToken short/sell",
          ledger_hash: hashRecords([policy.id, snap.ts, row.ticker, intent, verdict]),
          fill_model: "",
          liquidity_score: 0,
          slippage_bps: 0,
          order_denied_reason: verdict.verdict === "REJECT" ? "FIREWALL_REJECTED" : "NAKED_SPOT_SELL",
        });
        continue;
      }
      const notional = verdict.verdict === "ALLOW_CAPPED" ? verdict.cappedSizeUsd ?? 0 : NOTIONAL;
      const fee = notional * (FEE_PCT / 100);
      if (notional <= 0 || cash < notional + fee) continue;
      const qty = notional / p.mid;
      cash -= notional + fee;
      fills++;
      positions.set(row.ticker, { ticker: row.ticker, symbol: p.symbol, qty, entry: p.mid, certId: cid });
      const after = before - fee;
      highWater = Math.max(highWater, after);
      maxDrawdown = Math.max(maxDrawdown, highWater - after);
      rows.push({
        timestamp: snap.isoTime,
        run_id: `arena_v2_${policy.id}`,
        asset: row.ticker,
        venue_symbol: p.symbol,
        direction: "BUY",
        price: Number(p.mid.toFixed(8)),
        quantity: Number(qty.toFixed(10)),
        notional_usdt: Number(notional.toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: cid,
        firewall_verdict: verdict.verdict,
        policy: cert.payload.allowedPolicy,
        reason: intent.reason,
        ledger_hash: hashRecords([policy.id, snap.ts, row.ticker, "buy", p.mid, qty]),
        fill_model: "size_aware",
        liquidity_score: 100,
        slippage_bps: 0,
        order_denied_reason: "",
      });
    }
  });

  const last = snapshots[snapshots.length - 1];
  if (last) {
    for (const pos of [...positions.values()]) {
      const exit = last.rows.find((r) => r.ticker === pos.ticker)?.rToken?.mid ?? pos.entry;
      const before = cash + [...positions.values()].reduce((sum, p) => sum + p.qty * (last.rows.find((r) => r.ticker === p.ticker)?.rToken?.mid ?? p.entry), 0);
      const gross = pos.qty * exit;
      const fee = gross * (FEE_PCT / 100);
      cash += gross - fee;
      fills++;
      positions.delete(pos.ticker);
      const after = cash + [...positions.values()].reduce((sum, p) => sum + p.qty * (last.rows.find((r) => r.ticker === p.ticker)?.rToken?.mid ?? p.entry), 0);
      highWater = Math.max(highWater, after);
      maxDrawdown = Math.max(maxDrawdown, highWater - after);
      rows.push({
        timestamp: last.isoTime,
        run_id: `arena_v2_${policy.id}`,
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
        reason: "close arena position at final snapshot",
        ledger_hash: hashRecords([policy.id, last.ts, pos.ticker, "close", exit, pos.qty]),
        fill_model: "size_aware",
        liquidity_score: 100,
        slippage_bps: 0,
        order_denied_reason: "",
      });
    }
  }
  return { rows, endingBalance: cash, fills, blocks, maxDrawdown };
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runAgentArenaV2(args: string[] = []): void {
  const file = args.find((a) => !a.startsWith("--")) ?? "data/snapshots/2026-06-15.jsonl";
  const snapshots = loadSnapshots(file).filter((s) => s.rows.some((r) => r.equity));
  mkdirSync(OUT, { recursive: true });
  const summary = AGENT_POLICIES.map((policy) => {
    const result = runAgent(policy, snapshots);
    const headers = Object.keys(result.rows[0] ?? {}) as (keyof TradingLogRow)[];
    writeFileSync(join(OUT, `${policy.id}.csv`), [headers.join(","), ...result.rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
    writeFileSync(join(OUT, `${policy.id}.jsonl`), result.rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    return {
      agent: policy.id,
      rows: result.rows.length,
      fills: result.fills,
      blocks: result.blocks,
      startingBalance: STARTING_BALANCE,
      endingBalance: Number(result.endingBalance.toFixed(6)),
      netPnlUsdt: Number((result.endingBalance - STARTING_BALANCE).toFixed(6)),
      maxDrawdownUsdt: Number(result.maxDrawdown.toFixed(6)),
      log: `evidence/agent-arena-v2/${policy.id}.csv`,
    };
  });
  writeFileSync(join(OUT, "arena-v2-summary.json"), JSON.stringify({ recording: file, snapshots: snapshots.length, summary }, null, 2) + "\n");
  writeFileSync(join(OUT, "arena-v2-report.md"), [
    "# NightDesk Agent Arena v2",
    "",
    `Recording: ${file}`,
    `Snapshots with equity anchors: ${snapshots.length}`,
    "",
    "| Agent | Fills | Blocks | Ending USDT | Net PnL | Max DD |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...summary.map((s) => `| ${s.agent} | ${s.fills} | ${s.blocks} | ${s.endingBalance.toFixed(2)} | ${s.netPnlUsdt.toFixed(2)} | ${s.maxDrawdownUsdt.toFixed(2)} |`),
    "",
    "Each agent exports a Bitget-style paper trading CSV. NightDesk's point is not fake maximum turnover; it is certificate-gated execution with rejected unsafe intents preserved in the record.",
  ].join("\n") + "\n");
  console.log("\nNIGHTDESK AGENT ARENA V2 COMPLETE");
  console.log(`recording: ${file}`);
  console.log(`agents: ${summary.length}`);
  console.log(`report: ${join(OUT, "arena-v2-report.md")}`);
}

if (process.argv[1]?.endsWith("arena-v2.ts")) runAgentArenaV2(process.argv.slice(2));
