import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import type { Snapshot, PegRow } from "../pegwatch/collect";
import { certifyToken } from "./certify";
import { issueCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PerceptionContext } from "../perception/events";
import { hashRecords } from "../execution/exporter";

const OUT = join(process.cwd(), "evidence", "oos");
const STARTING_BALANCE = 1_000;
const NOTIONAL = 50;

export interface SessionStudyRow {
  session_id: string;
  date: string;
  start_time: string;
  end_time: string;
  tokens: number;
  intents: number;
  trades: number;
  blocks: number;
  abstains: number;
  guarded_pnl: number;
  unguarded_pnl: number;
  blocked_loss: number;
  ledger_hash: string;
}

const noEvents = (ticker: string): PerceptionContext => ({
  ticker,
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "" },
  severity: "none",
  abstainRecommended: false,
  summary: "session-study deterministic replay",
});

function p(row: PegRow): { symbol: string; mid: number | null } {
  return { symbol: row.rToken?.symbol ?? `${row.ticker}UNKNOWN`, mid: row.rToken?.mid ?? row.rToken?.last ?? null };
}

function intent(row: PegRow): "buy" | "sell" | null {
  const g = row.premiumVsEquityPct ?? row.premiumPct ?? null;
  if (g == null || Math.abs(g) < 0.2) return null;
  return g < 0 ? "buy" : "sell";
}

function equity(cash: number, positions: Map<string, { qty: number; entry: number }>, snap: Snapshot): number {
  return cash + [...positions.entries()].reduce((sum, [ticker, pos]) => sum + pos.qty * (snap.rows.find((r) => r.ticker === ticker)?.rToken?.mid ?? pos.entry), 0);
}

export function simulateSession(sessionId: string, snapshots: Snapshot[], costPct = 0.1): SessionStudyRow {
  const snaps = snapshots.filter((s) => s.rows.some((r) => r.equity));
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  if (!first || !last) {
    return { session_id: sessionId, date: sessionId, start_time: "", end_time: "", tokens: 0, intents: 0, trades: 0, blocks: 0, abstains: 0, guarded_pnl: 0, unguarded_pnl: 0, blocked_loss: 0, ledger_hash: hashRecords([sessionId, "empty"]) };
  }

  const run = (guarded: boolean) => {
    let cash = STARTING_BALANCE;
    let intents = 0;
    let trades = 0;
    let blocks = 0;
    let blockedLoss = 0;
    const positions = new Map<string, { qty: number; entry: number }>();
    for (const snap of snaps) {
      for (const row of snap.rows) {
        if (positions.has(row.ticker)) continue;
        const side = intent(row);
        if (!side) continue;
        intents++;
        const price = p(row);
        if (price.mid == null || price.mid <= 0) continue;
        let allowed = !guarded;
        let reason = "";
        if (guarded) {
          const cert = issueCertificate(certifyToken(row, noEvents(row.ticker)), {
            anchorSource: row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
            anchorStale: row.equity == null,
            now: snap.ts,
            ttlSec: 3600,
          });
          const verdict = evaluateIntent({ ticker: row.ticker, side, sizeUsd: NOTIONAL, certificate: cert }, snap.ts);
          allowed = verdict.verdict !== "REJECT" && side === "buy";
          reason = verdict.reason;
        } else {
          allowed = side === "buy";
        }
        if (!allowed) {
          blocks++;
          const final = last.rows.find((r) => r.ticker === row.ticker)?.rToken?.mid ?? price.mid;
          const dir = side === "buy" ? 1 : -1;
          const wouldPnL = dir * ((final - price.mid) / price.mid) * NOTIONAL - NOTIONAL * (costPct / 100) * 2;
          if (wouldPnL < 0 || /short|sell|REJECT|policy/i.test(reason)) blockedLoss += Math.min(0, wouldPnL);
          continue;
        }
        const fee = NOTIONAL * (costPct / 100);
        if (cash < NOTIONAL + fee) continue;
        cash -= NOTIONAL + fee;
        positions.set(row.ticker, { qty: NOTIONAL / price.mid, entry: price.mid });
        trades++;
      }
    }
    const endEquityBeforeFees = equity(cash, positions, last);
    const closeFees = [...positions.values()].reduce((sum, pos) => sum + pos.qty * pos.entry * (costPct / 100), 0);
    return { pnl: endEquityBeforeFees - closeFees - STARTING_BALANCE, intents, trades, blocks, blockedLoss };
  };

  const guarded = run(true);
  const unguarded = run(false);
  return {
    session_id: sessionId,
    date: first.isoTime.slice(0, 10),
    start_time: first.isoTime,
    end_time: last.isoTime,
    tokens: Math.max(...snaps.map((s) => s.rows.length)),
    intents: guarded.intents,
    trades: guarded.trades,
    blocks: guarded.blocks,
    abstains: Math.max(0, guarded.intents - guarded.trades - guarded.blocks),
    guarded_pnl: Number(guarded.pnl.toFixed(6)),
    unguarded_pnl: Number(unguarded.pnl.toFixed(6)),
    blocked_loss: Number(guarded.blockedLoss.toFixed(6)),
    ledger_hash: hashRecords([sessionId, guarded, unguarded]),
  };
}

export function availableSessionFiles(): string[] {
  const dir = join(process.cwd(), "data", "snapshots");
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().map((f) => join(dir, f));
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runOosReport(args: string[] = []): SessionStudyRow[] {
  const files = args.filter((a) => !a.startsWith("--"));
  const chosen = files.length ? files : availableSessionFiles();
  mkdirSync(join(OUT, "sessions"), { recursive: true });
  const rows = chosen.map((file) => {
    const id = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    const row = simulateSession(id, loadSnapshots(file));
    writeFileSync(join(OUT, "sessions", `${id}.json`), JSON.stringify({ file, row }, null, 2) + "\n");
    return row;
  });
  const headers = Object.keys(rows[0] ?? {}) as (keyof SessionStudyRow)[];
  writeFileSync(join(OUT, "session-summary.csv"), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), sessions: chosen, rows }, null, 2) + "\n");
  writeFileSync(join(OUT, "oos-report.md"), [
    "# NightDesk Multi-Session OOS Study",
    "",
    `Sessions: ${rows.length}`,
    `Total guarded PnL: ${rows.reduce((s, r) => s + r.guarded_pnl, 0).toFixed(2)} USDT`,
    `Total unguarded PnL: ${rows.reduce((s, r) => s + r.unguarded_pnl, 0).toFixed(2)} USDT`,
    `Logged blocked loss estimate: ${rows.reduce((s, r) => s + r.blocked_loss, 0).toFixed(2)} USDT`,
    "",
    "This is a multi-session replay over every available `data/snapshots/*.jsonl` file. It is not a promise of future alpha; it is evidence that NightDesk's safety gateway can be evaluated across sessions instead of a single hand-picked fixture.",
  ].join("\n") + "\n");
  console.log("\nNIGHTDESK OOS REPORT COMPLETE");
  console.log(`sessions: ${rows.length}`);
  console.log(`report: ${join(OUT, "oos-report.md")}`);
  return rows;
}

if (process.argv[1]?.endsWith("session-study.ts")) runOosReport(process.argv.slice(2));
