import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import type { Snapshot, PegRow } from "../pegwatch/collect";
import type { TradingLogRow } from "../execution/events";
import { hashRecords } from "../execution/exporter";
import { availableSessionFiles } from "./session-study";

const OUT = join(process.cwd(), "evidence", "alpha-championship");
const STARTING_BALANCE = 1_000;

export type SignalSource = "equity_gap" | "perp_gap";
export type Direction = "momentum" | "fade";

export interface AlphaConfig {
  id: string;
  source: SignalSource;
  direction: Direction;
  entryPct: number;
  exitPct: number;
  takeProfitPct: number;
  stopLossPct: number;
  maxHoldSnapshots: number;
  notionalPct: number;
  maxConcurrent: number;
  feePct: number;
}

interface Position {
  ticker: string;
  symbol: string;
  qty: number;
  entryPrice: number;
  entryIndex: number;
  entrySignal: number;
}

export interface AlphaResult {
  config: AlphaConfig;
  recording: string;
  snapshots: number;
  rows: TradingLogRow[];
  endingBalance: number;
  netPnl: number;
  maxDrawdown: number;
  fills: number;
  trades: number;
  wins: number;
  losses: number;
  fees: number;
}

function signal(row: PegRow, source: SignalSource): number | null {
  return source === "equity_gap" ? row.premiumVsEquityPct ?? null : row.premiumPct ?? null;
}

function mid(row: PegRow): { symbol: string; price: number | null } {
  return { symbol: row.rToken?.symbol ?? `${row.ticker}UNKNOWN`, price: row.rToken?.mid ?? row.rToken?.last ?? null };
}

function wantsEntry(g: number, cfg: AlphaConfig): boolean {
  if (cfg.direction === "momentum") return g >= cfg.entryPct;
  return g <= -cfg.entryPct;
}

function wantsExit(g: number | null, pos: Position, price: number, snapIndex: number, cfg: AlphaConfig): string | null {
  const pnlPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
  if (pnlPct >= cfg.takeProfitPct) return "take_profit";
  if (pnlPct <= -cfg.stopLossPct) return "stop_loss";
  if (snapIndex - pos.entryIndex >= cfg.maxHoldSnapshots) return "max_hold";
  if (g == null) return null;
  if (cfg.direction === "momentum" && g <= cfg.exitPct) return "signal_exit";
  if (cfg.direction === "fade" && g >= -cfg.exitPct) return "signal_exit";
  return null;
}

function equity(cash: number, positions: Map<string, Position>, snap: Snapshot): number {
  let value = cash;
  for (const pos of positions.values()) {
    const mark = snap.rows.find((r) => r.ticker === pos.ticker)?.rToken?.mid ?? pos.entryPrice;
    value += pos.qty * mark;
  }
  return value;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runAlphaConfig(recording: string, snapshots: Snapshot[], cfg: AlphaConfig): AlphaResult {
  const snaps = snapshots.filter((s) => s.rows.some((r) => r.equity));
  let cash = STARTING_BALANCE;
  let highWater = STARTING_BALANCE;
  let maxDrawdown = 0;
  let fills = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let fees = 0;
  const positions = new Map<string, Position>();
  const rows: TradingLogRow[] = [];

  snaps.forEach((snap, snapIndex) => {
    for (const [ticker, pos] of [...positions.entries()]) {
      const row = snap.rows.find((r) => r.ticker === ticker);
      if (!row) continue;
      const mark = mid(row);
      const g = signal(row, cfg.source);
      if (mark.price == null || mark.price <= 0) continue;
      const reason = wantsExit(g, pos, mark.price, snapIndex, cfg);
      if (!reason) continue;
      const before = equity(cash, positions, snap);
      const gross = pos.qty * mark.price;
      const fee = gross * (cfg.feePct / 100);
      cash += gross - fee;
      fees += fee;
      positions.delete(ticker);
      fills++;
      const tradePnl = gross - fee - pos.qty * pos.entryPrice;
      if (tradePnl >= 0) wins++;
      else losses++;
      const after = equity(cash, positions, snap);
      highWater = Math.max(highWater, after);
      maxDrawdown = Math.max(maxDrawdown, highWater - after);
      rows.push({
        timestamp: snap.isoTime,
        run_id: `alpha_${cfg.id}`,
        asset: ticker,
        venue_symbol: pos.symbol,
        direction: "SELL",
        price: Number(mark.price.toFixed(8)),
        quantity: Number(pos.qty.toFixed(10)),
        notional_usdt: Number(gross.toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: "alpha_research",
        firewall_verdict: "ALLOW",
        policy: "RAW_PNL_ALPHA_RESEARCH",
        reason,
        ledger_hash: hashRecords([cfg.id, recording, snap.ts, ticker, "sell", mark.price, pos.qty]),
      });
    }

    const currentEquity = equity(cash, positions, snap);
    highWater = Math.max(highWater, currentEquity);
    maxDrawdown = Math.max(maxDrawdown, highWater - currentEquity);

    const candidates = snap.rows
      .map((row) => ({ row, g: signal(row, cfg.source), p: mid(row) }))
      .filter((x) => x.g != null && x.p.price != null && x.p.price > 0 && wantsEntry(x.g, cfg))
      .sort((a, b) => Math.abs(b.g!) - Math.abs(a.g!));

    for (const candidate of candidates) {
      if (positions.size >= cfg.maxConcurrent) break;
      if (positions.has(candidate.row.ticker)) continue;
      const price = candidate.p.price!;
      const before = equity(cash, positions, snap);
      const targetNotional = before * cfg.notionalPct;
      const notional = Math.min(targetNotional, Math.max(0, cash / (1 + cfg.feePct / 100)));
      const fee = notional * (cfg.feePct / 100);
      if (notional <= 1 || cash < notional + fee) continue;
      const qty = notional / price;
      cash -= notional + fee;
      fees += fee;
      positions.set(candidate.row.ticker, {
        ticker: candidate.row.ticker,
        symbol: candidate.p.symbol,
        qty,
        entryPrice: price,
        entryIndex: snapIndex,
        entrySignal: candidate.g!,
      });
      fills++;
      trades++;
      const after = equity(cash, positions, snap);
      highWater = Math.max(highWater, after);
      maxDrawdown = Math.max(maxDrawdown, highWater - after);
      rows.push({
        timestamp: snap.isoTime,
        run_id: `alpha_${cfg.id}`,
        asset: candidate.row.ticker,
        venue_symbol: candidate.p.symbol,
        direction: "BUY",
        price: Number(price.toFixed(8)),
        quantity: Number(qty.toFixed(10)),
        notional_usdt: Number(notional.toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: "alpha_research",
        firewall_verdict: "ALLOW",
        policy: "RAW_PNL_ALPHA_RESEARCH",
        reason: `${cfg.direction} ${cfg.source} entry ${candidate.g!.toFixed(4)}%`,
        ledger_hash: hashRecords([cfg.id, recording, snap.ts, candidate.row.ticker, "buy", price, qty]),
      });
    }
  });

  const last = snaps[snaps.length - 1];
  if (last) {
    for (const [ticker, pos] of [...positions.entries()]) {
      const row = last.rows.find((r) => r.ticker === ticker);
      const price = row?.rToken?.mid ?? pos.entryPrice;
      const before = equity(cash, positions, last);
      const gross = pos.qty * price;
      const fee = gross * (cfg.feePct / 100);
      cash += gross - fee;
      fees += fee;
      positions.delete(ticker);
      fills++;
      const tradePnl = gross - fee - pos.qty * pos.entryPrice;
      if (tradePnl >= 0) wins++;
      else losses++;
      const after = equity(cash, positions, last);
      highWater = Math.max(highWater, after);
      maxDrawdown = Math.max(maxDrawdown, highWater - after);
      rows.push({
        timestamp: last.isoTime,
        run_id: `alpha_${cfg.id}`,
        asset: ticker,
        venue_symbol: pos.symbol,
        direction: "SELL",
        price: Number(price.toFixed(8)),
        quantity: Number(pos.qty.toFixed(10)),
        notional_usdt: Number(gross.toFixed(6)),
        balance_before: Number(before.toFixed(6)),
        balance_after: Number(after.toFixed(6)),
        balance_change: Number((after - before).toFixed(6)),
        certificate_id: "alpha_research",
        firewall_verdict: "ALLOW",
        policy: "RAW_PNL_ALPHA_RESEARCH",
        reason: "final_close",
        ledger_hash: hashRecords([cfg.id, recording, last.ts, ticker, "final_close", price, pos.qty]),
      });
    }
  }

  const endingBalance = Number(cash.toFixed(6));
  return {
    config: cfg,
    recording,
    snapshots: snaps.length,
    rows,
    endingBalance,
    netPnl: Number((endingBalance - STARTING_BALANCE).toFixed(6)),
    maxDrawdown: Number(maxDrawdown.toFixed(6)),
    fills,
    trades,
    wins,
    losses,
    fees: Number(fees.toFixed(6)),
  };
}

export function alphaConfigGrid(deep = false): AlphaConfig[] {
  const out: AlphaConfig[] = [];
  const sources: SignalSource[] = ["equity_gap", "perp_gap"];
  const directions: Direction[] = ["momentum", "fade"];
  const entries = deep ? [0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1.0] : [0.1, 0.2, 0.35, 0.5, 0.75];
  const exits = deep ? [0, 0.05, 0.1, 0.2] : [0, 0.1];
  const takeProfits = deep ? [0.4, 0.75, 1.25, 2, 3] : [0.75, 1.25, 2];
  const stopLosses = deep ? [0.4, 0.75, 1.25, 2.5, 5] : [0.75, 1.25, 2.5];
  const holds = deep ? [5, 15, 30, 90, 9999] : [15, 30, 9999];
  const notionals = deep ? [0.1, 0.2, 0.35, 0.5] : [0.2, 0.35, 0.5];
  const concurrent = deep ? [1, 2, 3, 5, 8] : [2, 5, 8];
  for (const source of sources) {
    for (const direction of directions) {
      for (const entryPct of entries) {
        for (const exitPct of exits) {
          if (exitPct > entryPct) continue;
          for (const takeProfitPct of takeProfits) {
            for (const stopLossPct of stopLosses) {
              for (const maxHoldSnapshots of holds) {
                for (const notionalPct of notionals) {
                  for (const maxConcurrent of concurrent) {
                    out.push({
                      id: [
                        source,
                        direction,
                        `e${entryPct}`,
                        `x${exitPct}`,
                        `tp${takeProfitPct}`,
                        `sl${stopLossPct}`,
                        `h${maxHoldSnapshots}`,
                        `n${notionalPct}`,
                        `m${maxConcurrent}`,
                      ].join("_").replace(/\./g, "p"),
                      source,
                      direction,
                      entryPct,
                      exitPct,
                      takeProfitPct,
                      stopLossPct,
                      maxHoldSnapshots,
                      notionalPct,
                      maxConcurrent,
                      feePct: 0.1,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}

function writeCsv(file: string, rows: Record<string, unknown>[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
}

export function runAlphaChampionship(args: string[] = []): void {
  const inputFiles = args.filter((a) => !a.startsWith("--"));
  const files = (inputFiles.length ? inputFiles : availableSessionFiles()).sort();
  const deep = args.includes("--deep");
  const configs = alphaConfigGrid(deep);
  mkdirSync(OUT, { recursive: true });

  const perFileBest: AlphaResult[] = [];
  const allRows: Record<string, unknown>[] = [];
  const configsById = new Map(configs.map((cfg) => [cfg.id, cfg]));

  for (const file of files) {
    const snapshots = loadSnapshots(file);
    const recording = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    let best: AlphaResult | null = null;
    for (const cfg of configs) {
      const result = runAlphaConfig(recording, snapshots, cfg);
      allRows.push({
        recording,
        config_id: cfg.id,
        source: cfg.source,
        direction: cfg.direction,
        entry_pct: cfg.entryPct,
        exit_pct: cfg.exitPct,
        take_profit_pct: cfg.takeProfitPct,
        stop_loss_pct: cfg.stopLossPct,
        max_hold_snapshots: cfg.maxHoldSnapshots,
        notional_pct: cfg.notionalPct,
        max_concurrent: cfg.maxConcurrent,
        trades: result.trades,
        fills: result.fills,
        wins: result.wins,
        losses: result.losses,
        win_rate: result.wins + result.losses > 0 ? Number((result.wins / (result.wins + result.losses)).toFixed(6)) : 0,
        ending_balance: result.endingBalance,
        net_pnl: result.netPnl,
        max_drawdown: result.maxDrawdown,
        fees: result.fees,
      });
      if (!best || result.netPnl > best.netPnl) best = result;
    }
    if (best) perFileBest.push(best);
  }

  const leaderboard = [...allRows].sort((a, b) => Number(b.net_pnl) - Number(a.net_pnl));
  const aggregate = new Map<string, {
    config: AlphaConfig;
    sessions: number;
    positiveSessions: number;
    totalPnl: number;
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    maxDrawdown: number;
    totalFees: number;
  }>();
  for (const row of allRows) {
    const id = String(row.config_id);
    const cfg = configsById.get(id);
    if (!cfg) continue;
    const prev = aggregate.get(id) ?? {
      config: cfg,
      sessions: 0,
      positiveSessions: 0,
      totalPnl: 0,
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      maxDrawdown: 0,
      totalFees: 0,
    };
    const pnl = Number(row.net_pnl);
    prev.sessions++;
    if (pnl > 0) prev.positiveSessions++;
    prev.totalPnl += pnl;
    prev.totalTrades += Number(row.trades);
    prev.totalWins += Number(row.wins);
    prev.totalLosses += Number(row.losses);
    prev.maxDrawdown = Math.max(prev.maxDrawdown, Number(row.max_drawdown));
    prev.totalFees += Number(row.fees);
    aggregate.set(id, prev);
  }
  const aggregateRows = [...aggregate.values()]
    .map((r) => ({
      config_id: r.config.id,
      source: r.config.source,
      direction: r.config.direction,
      entry_pct: r.config.entryPct,
      exit_pct: r.config.exitPct,
      take_profit_pct: r.config.takeProfitPct,
      stop_loss_pct: r.config.stopLossPct,
      max_hold_snapshots: r.config.maxHoldSnapshots,
      notional_pct: r.config.notionalPct,
      max_concurrent: r.config.maxConcurrent,
      sessions: r.sessions,
      positive_sessions: r.positiveSessions,
      total_trades: r.totalTrades,
      total_wins: r.totalWins,
      total_losses: r.totalLosses,
      total_pnl: Number(r.totalPnl.toFixed(6)),
      avg_pnl: Number((r.totalPnl / Math.max(1, r.sessions)).toFixed(6)),
      max_drawdown: Number(r.maxDrawdown.toFixed(6)),
      total_fees: Number(r.totalFees.toFixed(6)),
    }))
    .sort((a, b) => Number(b.total_pnl) - Number(a.total_pnl));
  const globalChampionConfig = configsById.get(String(aggregateRows[0]?.config_id));
  const globalChampionResults = globalChampionConfig
    ? files.map((file) => {
        const snapshots = loadSnapshots(file);
        const recording = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
        return runAlphaConfig(recording, snapshots, globalChampionConfig);
      })
    : [];
  const globalChampion = aggregateRows[0];
  writeCsv("leaderboard.csv", leaderboard.slice(0, 500));
  writeCsv("aggregate-leaderboard.csv", aggregateRows.slice(0, 500));
  writeCsv("session-best.csv", perFileBest.map((r) => ({
    recording: r.recording,
    config_id: r.config.id,
    source: r.config.source,
    direction: r.config.direction,
    entry_pct: r.config.entryPct,
    exit_pct: r.config.exitPct,
    take_profit_pct: r.config.takeProfitPct,
    stop_loss_pct: r.config.stopLossPct,
    max_hold_snapshots: r.config.maxHoldSnapshots,
    notional_pct: r.config.notionalPct,
    max_concurrent: r.config.maxConcurrent,
    trades: r.trades,
    fills: r.fills,
    wins: r.wins,
    losses: r.losses,
    ending_balance: r.endingBalance,
    net_pnl: r.netPnl,
    max_drawdown: r.maxDrawdown,
    fees: r.fees,
  })));

  const champion = perFileBest.sort((a, b) => b.netPnl - a.netPnl)[0];
  if (champion) {
    const headers = Object.keys(champion.rows[0] ?? {}) as (keyof TradingLogRow)[];
    writeFileSync(join(OUT, "champion-paper-trading-log.csv"), [headers.join(","), ...champion.rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
    writeFileSync(join(OUT, "champion-paper-trading-log.jsonl"), champion.rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    writeFileSync(join(OUT, "champion-config.json"), JSON.stringify(champion.config, null, 2) + "\n");
  }
  if (globalChampionConfig) {
    writeFileSync(join(OUT, "global-champion-config.json"), JSON.stringify(globalChampionConfig, null, 2) + "\n");
    writeCsv("global-champion-session-results.csv", globalChampionResults.map((r) => ({
      recording: r.recording,
      trades: r.trades,
      fills: r.fills,
      wins: r.wins,
      losses: r.losses,
      ending_balance: r.endingBalance,
      net_pnl: r.netPnl,
      max_drawdown: r.maxDrawdown,
      fees: r.fees,
    })));
    const combinedRows = globalChampionResults.flatMap((r) => r.rows.map((row) => ({ ...row, run_id: `global_${row.run_id}_${r.recording}` })));
    const headers = Object.keys(combinedRows[0] ?? {}) as (keyof TradingLogRow)[];
    writeFileSync(join(OUT, "global-champion-paper-trading-log.csv"), [headers.join(","), ...combinedRows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
    writeFileSync(join(OUT, "global-champion-paper-trading-log.jsonl"), combinedRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }

  writeFileSync(join(OUT, "alpha-championship-report.md"), [
    "# NightDesk Raw-PnL Alpha Championship",
    "",
    "Purpose: search the current recorded snapshot set for the highest raw-PnL spot policy. This is explicitly in-sample research evidence, not a production alpha guarantee.",
    "",
    `Recordings: ${files.length}`,
    `Mode: ${deep ? "deep" : "fast"}`,
    `Configs scanned per recording: ${configs.length}`,
    `Total runs: ${configs.length * files.length}`,
    "",
    champion
      ? [
          "## Champion",
          "",
          `Recording: ${champion.recording}`,
          `Config: ${champion.config.id}`,
          `Signal: ${champion.config.source} / ${champion.config.direction}`,
          `Ending balance: ${champion.endingBalance.toFixed(2)} USDT`,
          `Net PnL: ${champion.netPnl.toFixed(2)} USDT`,
          `Max drawdown: ${champion.maxDrawdown.toFixed(2)} USDT`,
          `Trades: ${champion.trades}`,
          `Wins/Losses: ${champion.wins}/${champion.losses}`,
          `Paper log: evidence/alpha-championship/champion-paper-trading-log.csv`,
        ].join("\n")
      : "No champion generated.",
    "",
    globalChampion && globalChampionConfig
      ? [
          "## Global Champion Across Recordings",
          "",
          `Config: ${globalChampionConfig.id}`,
          `Signal: ${globalChampionConfig.source} / ${globalChampionConfig.direction}`,
          `Total PnL across recordings: ${Number(globalChampion.total_pnl).toFixed(2)} USDT`,
          `Average PnL per recording: ${Number(globalChampion.avg_pnl).toFixed(2)} USDT`,
          `Positive sessions: ${globalChampion.positive_sessions}/${globalChampion.sessions}`,
          `Total trades: ${globalChampion.total_trades}`,
          `Total wins/losses: ${globalChampion.total_wins}/${globalChampion.total_losses}`,
          `Max session drawdown: ${Number(globalChampion.max_drawdown).toFixed(2)} USDT`,
          `Combined paper log: evidence/alpha-championship/global-champion-paper-trading-log.csv`,
        ].join("\n")
      : "No global champion generated.",
    "",
    "## Submission Discipline",
    "",
    "Use this as a raw-PnL research layer beside the safety gateway. Do not claim this is out-of-sample alpha until the selected config is frozen and replayed on future sessions.",
  ].join("\n") + "\n");

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: deep ? "deep" : "fast",
    files,
    configsScannedPerRecording: configs.length,
    totalRuns: configs.length * files.length,
    globalChampion: globalChampion && globalChampionConfig ? {
      config: globalChampionConfig,
      totalPnl: Number(globalChampion.total_pnl),
      avgPnl: Number(globalChampion.avg_pnl),
      positiveSessions: Number(globalChampion.positive_sessions),
      sessions: Number(globalChampion.sessions),
      totalTrades: Number(globalChampion.total_trades),
      totalWins: Number(globalChampion.total_wins),
      totalLosses: Number(globalChampion.total_losses),
      maxDrawdown: Number(globalChampion.max_drawdown),
    } : null,
    champion: champion ? {
      recording: champion.recording,
      config: champion.config,
      endingBalance: champion.endingBalance,
      netPnl: champion.netPnl,
      maxDrawdown: champion.maxDrawdown,
      trades: champion.trades,
      wins: champion.wins,
      losses: champion.losses,
    } : null,
  }, null, 2) + "\n");

  console.log("\nNIGHTDESK RAW-PNL ALPHA CHAMPIONSHIP COMPLETE");
  console.log(`recordings: ${files.length}`);
  console.log(`mode: ${deep ? "deep" : "fast"}`);
  console.log(`configs per recording: ${configs.length}`);
  if (champion) {
    console.log(`champion: ${champion.config.id}`);
    console.log(`recording: ${champion.recording}`);
    console.log(`ending balance: ${champion.endingBalance.toFixed(2)}`);
    console.log(`net pnl: ${champion.netPnl.toFixed(2)}`);
  }
  if (globalChampion && globalChampionConfig) {
    console.log(`global champion: ${globalChampionConfig.id}`);
    console.log(`global total pnl: ${Number(globalChampion.total_pnl).toFixed(2)}`);
    console.log(`global positive sessions: ${globalChampion.positive_sessions}/${globalChampion.sessions}`);
  }
  console.log(`report: ${join(OUT, "alpha-championship-report.md")}`);
}

if (process.argv[1]?.endsWith("alpha-championship.ts")) runAlphaChampionship(process.argv.slice(2));
