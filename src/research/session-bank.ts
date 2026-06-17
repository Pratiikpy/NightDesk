import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "oos", "session-bank");

function lines(file: string): string[] {
  return existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean) : [];
}

function parseCsv(file: string): Record<string, string>[] {
  const rows = lines(file);
  if (!rows.length) return [];
  const headers = rows[0]!.split(",");
  return rows.slice(1).map((line) => Object.fromEntries(line.split(",").map((cell, i) => [headers[i] ?? `col${i}`, cell])));
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: Record<string, unknown>[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
}

function sessionType(row: Record<string, string>): string {
  const start = Date.parse(row.start_time ?? "");
  const end = Date.parse(row.end_time ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unknown";
  const hours = (end - start) / 3_600_000;
  const day = new Date(start).getUTCDay();
  if (day === 5 && hours > 24) return "weekend_to_monday_candidate";
  if (hours < 1) return "short_live_capture";
  if (hours < 8) return "intraday_or_partial";
  return "overnight_or_multi_hour";
}

export function runSessionBank(): void {
  mkdirSync(join(OUT, "session-cards"), { recursive: true });
  mkdirSync(join(OUT, "session-ledgers"), { recursive: true });
  const rows = parseCsv(join(process.cwd(), "evidence", "oos", "session-summary.csv"));
  const enriched = rows.map((row) => {
    const startingBalance = 1000;
    const guardedPnl = Number(row.guarded_pnl ?? 0);
    const unguardedPnl = Number(row.unguarded_pnl ?? 0);
    const endingBalance = startingBalance + guardedPnl;
    return {
      session_id: row.session_id,
      date: row.date,
      session_type: sessionType(row),
      start_time: row.start_time,
      end_time: row.end_time,
      tokens_scanned: row.tokens,
      intents_created: row.intents,
      trades: row.trades,
      blocks: row.blocks,
      abstains: row.abstains,
      starting_balance: startingBalance.toFixed(2),
      ending_balance: endingBalance.toFixed(6),
      guarded_pnl: row.guarded_pnl,
      unguarded_pnl: row.unguarded_pnl,
      guarded_vs_unguarded_delta: (guardedPnl - unguardedPnl).toFixed(6),
      max_drawdown: "see walkforward/fill reports",
      ledger_hash: row.ledger_hash,
      reproduce_command: "npm run oos:report && npm run oos:session-bank",
    };
  });
  writeCsv("session-summary.csv", enriched);

  for (const row of enriched) {
    const id = String(row.session_id);
    writeFileSync(join(OUT, "session-ledgers", `${id}.json`), JSON.stringify({
      session_id: id,
      ledger_hash: row.ledger_hash,
      guarded_pnl: row.guarded_pnl,
      unguarded_pnl: row.unguarded_pnl,
      reproduce_command: row.reproduce_command,
    }, null, 2) + "\n");
    writeFileSync(join(OUT, "session-cards", `${id}.md`), [
      `# Session ${id}`,
      "",
      `Date: ${row.date}`,
      `Type: ${row.session_type}`,
      `Window: ${row.start_time} -> ${row.end_time}`,
      `Tokens scanned: ${row.tokens_scanned}`,
      `Intents: ${row.intents_created}`,
      `Trades / Blocks / Abstains: ${row.trades} / ${row.blocks} / ${row.abstains}`,
      `Starting balance: ${row.starting_balance} USDT`,
      `Ending balance: ${row.ending_balance} USDT`,
      `Guarded PnL: ${row.guarded_pnl} USDT`,
      `Unguarded PnL: ${row.unguarded_pnl} USDT`,
      `Delta: ${row.guarded_vs_unguarded_delta} USDT`,
      `Ledger hash: ${row.ledger_hash}`,
      `Reproduce: \`${row.reproduce_command}\``,
      "",
    ].join("\n"));
  }

  const target = 20;
  const totalGuarded = enriched.reduce((s, r) => s + Number(r.guarded_pnl), 0);
  const totalUnguarded = enriched.reduce((s, r) => s + Number(r.unguarded_pnl), 0);
  const quality = [
    "# OOS Session Bank Quality Report",
    "",
    `Current sessions: ${enriched.length}`,
    `Minimum target: 10`,
    `Strong target: 20`,
    `Elite target: 50`,
    `Progress to strong target: ${Math.min(100, (enriched.length / target) * 100).toFixed(1)}%`,
    `Total guarded PnL: ${totalGuarded.toFixed(6)} USDT`,
    `Total unguarded PnL: ${totalUnguarded.toFixed(6)} USDT`,
    `Guarded vs unguarded delta: ${(totalGuarded - totalUnguarded).toFixed(6)} USDT`,
    "",
    "The OOS daemon appends future sessions over wall-clock market time. This report does not fabricate future evidence.",
    "",
  ].join("\n");
  writeFileSync(join(OUT, "session-quality-report.md"), quality);
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sessions: enriched.length,
    targets: { minimum: 10, strong: 20, elite: 50 },
    files: ["session-summary.csv", "session-quality-report.md", "session-cards/", "session-ledgers/"],
  }, null, 2) + "\n");
  console.log(`NIGHTDESK OOS SESSION BANK COMPLETE: ${join(OUT, "session-quality-report.md")}`);
}

if (process.argv[1]?.endsWith("session-bank.ts")) runSessionBank();
