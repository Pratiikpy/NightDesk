import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Severity = "pass" | "warn" | "fail";

interface Check {
  name: string;
  severity: Severity;
  detail: string;
}

const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "outcome-audit");

function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

function lines(file: string): string[] {
  return read(file).split(/\r?\n/).filter(Boolean);
}

function parseCsv(file: string): Record<string, string>[] {
  const rows = lines(file);
  if (!rows.length) return [];
  const headers = splitCsvLine(rows[0]!);
  return rows.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    const n = line[i + 1];
    if (quoted && c === "\"" && n === "\"") {
      cell += "\"";
      i++;
    } else if (c === "\"") {
      quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cell);
      cell = "";
    } else {
      cell += c;
    }
  }
  out.push(cell);
  return out;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function check(name: string, fn: () => Omit<Check, "name">): Check {
  try {
    return { name, ...fn() };
  } catch (e) {
    return { name, severity: "fail", detail: (e as Error).message };
  }
}

function summarizeTradingLog(rows: Record<string, string>[]) {
  const fills = rows.filter((r) => r.direction !== "BLOCK");
  const blocks = rows.filter((r) => r.direction === "BLOCK");
  const buyNotional = fills.filter((r) => r.direction === "BUY").reduce((s, r) => s + num(r.notional_usdt), 0);
  const sellNotional = fills.filter((r) => r.direction === "SELL").reduce((s, r) => s + num(r.notional_usdt), 0);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const start = num(first?.balance_before);
  const end = num(last?.balance_after);
  return {
    rows: rows.length,
    fills: fills.length,
    blocks: blocks.length,
    buyNotional,
    sellNotional,
    start,
    end,
    net: end - start,
    denialCodes: new Set(blocks.map((r) => r.order_denied_reason).filter(Boolean)),
    assets: new Set(rows.map((r) => r.asset).filter(Boolean)),
  };
}

export function runOutcomeAudit(): Check[] {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  checks.push(check("required outcome files", () => {
    const files = [
      "evidence/trading-log/nightdesk-paper-trading-log.csv",
      "evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv",
      "evidence/agent-arena-v2/arena-v2-summary.json",
      "evidence/oos/session-summary.csv",
      "evidence/walkforward/fold-results.csv",
      "evidence/fill-model/partial-fill-cases.csv",
      "evidence/integration/external-agent-run.jsonl",
      "evidence/bitget-live/live-market-snapshot.json",
    ];
    const missing = files.filter((f) => !existsSync(join(ROOT, f)));
    return missing.length
      ? { severity: "fail", detail: `missing ${missing.join(", ")}` }
      : { severity: "pass", detail: `${files.length} outcome files present` };
  }));

  checks.push(check("Bitget-required paper log fields and actions", () => {
    const rows = parseCsv("evidence/trading-log/nightdesk-paper-trading-log.csv");
    const required = ["timestamp", "asset", "direction", "price", "quantity", "balance_change"];
    const headers = Object.keys(rows[0] ?? {});
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length) return { severity: "fail", detail: `missing columns: ${missing.join(", ")}` };
    const s = summarizeTradingLog(rows);
    if (s.assets.size < 10) return { severity: "fail", detail: `too few assets covered: ${s.assets.size}` };
    if (s.fills < 3) return { severity: "fail", detail: `too few simulated fills: ${s.fills}` };
    if (s.blocks < 3) return { severity: "fail", detail: `too few blocked unsafe/non-executable intents: ${s.blocks}` };
    return { severity: "pass", detail: `${s.rows} rows, ${s.fills} fills, ${s.blocks} blocks, ${s.assets.size} assets` };
  }));

  checks.push(check("single-session paper economics", () => {
    const s = summarizeTradingLog(parseCsv("evidence/trading-log/nightdesk-paper-trading-log.csv"));
    if (s.net > 0) return { severity: "pass", detail: `paper-session net +${s.net.toFixed(4)} USDT` };
    return {
      severity: "warn",
      detail: `paper-session net ${s.net.toFixed(4)} USDT; this proves execution/logging but not standalone profit`,
    };
  }));

  checks.push(check("guarded replay economics", () => {
    const s = summarizeTradingLog(parseCsv("evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv"));
    if (s.net <= 0) return { severity: "fail", detail: `guarded replay net ${s.net.toFixed(4)} USDT` };
    return { severity: "pass", detail: `guarded replay net +${s.net.toFixed(4)} USDT across ${s.fills} fills and ${s.blocks} blocks` };
  }));

  checks.push(check("arena outcome honesty", () => {
    const arena = JSON.parse(read("evidence/agent-arena-v2/arena-v2-summary.json")) as { summary: { agent: string; netPnlUsdt: number; maxDrawdownUsdt: number }[] };
    const ordered = [...arena.summary].sort((a, b) => b.netPnlUsdt - a.netPnlUsdt);
    const nd = arena.summary.find((r) => r.agent === "nightdesk_guarded_agent");
    if (!nd) return { severity: "fail", detail: "nightdesk_guarded_agent missing from arena" };
    const rank = ordered.findIndex((r) => r.agent === nd.agent) + 1;
    const best = ordered[0]!;
    if (rank === 1) return { severity: "pass", detail: `NightDesk ranks #1 by arena PnL at ${nd.netPnlUsdt.toFixed(4)} USDT` };
    return {
      severity: "warn",
      detail: `NightDesk ranks #${rank}/${ordered.length} by arena PnL (${nd.netPnlUsdt.toFixed(4)} USDT); best is ${best.agent} at ${best.netPnlUsdt.toFixed(4)} USDT. Pitch as safety gateway, not max-PnL bot.`,
    };
  }));

  checks.push(check("same-agent guarded delta is present", () => {
    const arena = JSON.parse(read("evidence/agent-arena-v2/arena-v2-summary.json")) as { summary: { agent: string; netPnlUsdt: number; maxDrawdownUsdt: number }[] };
    const byAgent = new Map(arena.summary.map((r) => [r.agent, r]));
    const bases = ["naive_gap_agent", "perp_trust_agent", "momentum_agent", "news_blind_agent", "random_agent"];
    const paired = bases.filter((base) => byAgent.has(base) && byAgent.has(`${base}_guarded`)).map((base) => {
      const u = byAgent.get(base)!;
      const g = byAgent.get(`${base}_guarded`)!;
      return { base, pnlDelta: g.netPnlUsdt - u.netPnlUsdt, ddDelta: g.maxDrawdownUsdt - u.maxDrawdownUsdt };
    });
    if (paired.length < 3) return { severity: "fail", detail: `only ${paired.length} guarded/unguarded pairs` };
    const improvedPnl = paired.filter((p) => p.pnlDelta > 0).length;
    const reducedDd = paired.filter((p) => p.ddDelta < 0).length;
    if (improvedPnl || reducedDd) return { severity: "pass", detail: `${paired.length} same-agent pairs; pnl improved in ${improvedPnl}, drawdown reduced in ${reducedDd}` };
    return { severity: "warn", detail: `${paired.length} same-agent pairs exist, but none improve PnL or drawdown in this sample` };
  }));

  checks.push(check("arena downside behavior", () => {
    const arena = JSON.parse(read("evidence/agent-arena-v2/arena-v2-summary.json")) as { summary: { agent: string; netPnlUsdt: number; maxDrawdownUsdt: number }[] };
    const nd = arena.summary.find((r) => r.agent === "nightdesk_guarded_agent");
    if (!nd) return { severity: "fail", detail: "nightdesk_guarded_agent missing" };
    const dds = arena.summary.map((r) => r.maxDrawdownUsdt).sort((a, b) => a - b);
    const median = dds[Math.floor(dds.length / 2)] ?? 0;
    if (nd.maxDrawdownUsdt <= median) return { severity: "pass", detail: `NightDesk max DD ${nd.maxDrawdownUsdt.toFixed(4)} USDT is at/below arena median ${median.toFixed(4)}` };
    return { severity: "warn", detail: `NightDesk max DD ${nd.maxDrawdownUsdt.toFixed(4)} USDT is above arena median ${median.toFixed(4)}` };
  }));

  checks.push(check("walk-forward differential", () => {
    const folds = parseCsv("evidence/walkforward/fold-results.csv");
    const trading = folds.filter((r) => num(r.test_trades) > 0);
    if (trading.length < 2) return { severity: "warn", detail: `only ${trading.length} trading walk-forward folds` };
    const deltas = trading.map((r) => num(r.guarded_delta));
    const positive = deltas.filter((d) => d > 0).length;
    const negative = deltas.filter((d) => d < 0).length;
    const total = deltas.reduce((s, d) => s + d, 0);
    if (positive > negative && total > 0) return { severity: "pass", detail: `positive guarded delta in ${positive}/${trading.length} trading folds, total ${total.toFixed(4)} USDT` };
    return {
      severity: "warn",
      detail: `no demonstrated walk-forward PnL uplift yet: positive=${positive}, negative=${negative}, total_delta=${total.toFixed(4)} USDT`,
    };
  }));

  checks.push(check("OOS session depth", () => {
    const sessions = parseCsv("evidence/oos/session-summary.csv");
    const active = sessions.filter((r) => num(r.trades) > 0 || num(r.blocks) > 0);
    if (sessions.length >= 10 && active.length >= 5) return { severity: "pass", detail: `${sessions.length} sessions, ${active.length} active` };
    return {
      severity: "warn",
      detail: `${sessions.length} sessions, ${active.length} active. This is enough for a hackathon evidence pack, not enough for a production alpha claim.`,
    };
  }));

  checks.push(check("fill realism outcome cases", () => {
    const rows = parseCsv("evidence/fill-model/partial-fill-cases.csv");
    const failed = rows.filter((r) => r.status !== "pass");
    if (failed.length) return { severity: "fail", detail: `failed fill cases: ${failed.map((r) => r.case_id).join(", ")}` };
    const required = ["empty_book", "one_sided_book", "crossed_book", "wide_spread", "partial_depth", "stale_quote", "normal_quote"];
    const seen = new Set(rows.map((r) => r.case_id));
    const missing = required.filter((id) => !seen.has(id));
    if (missing.length) return { severity: "fail", detail: `missing fill cases: ${missing.join(", ")}` };
    return { severity: "pass", detail: `${rows.length}/${rows.length} fill realism cases pass` };
  }));

  checks.push(check("external integration proof", () => {
    const calls = lines("evidence/integration/external-agent-run.jsonl").map((line) => JSON.parse(line)) as { response?: { verdict?: string } }[];
    const verdicts = new Set(calls.map((c) => c.response?.verdict).filter(Boolean));
    if (calls.length < 3) return { severity: "fail", detail: `only ${calls.length} external calls` };
    if (!verdicts.size) return { severity: "fail", detail: "no external verdicts found" };
    return { severity: "pass", detail: `${calls.length} external agent calls, verdicts: ${[...verdicts].join("/")}` };
  }));

  checks.push(check("live/read-only Bitget proof", () => {
    const snapshot = JSON.parse(read("evidence/bitget-live/live-market-snapshot.json")) as Record<string, unknown>;
    const text = JSON.stringify(snapshot);
    if (/api[_-]?key|secret|passphrase/i.test(text)) return { severity: "fail", detail: "snapshot contains possible secret material" };
    if (!snapshot.symbol) return { severity: "fail", detail: "snapshot lacks symbol" };
    return { severity: "pass", detail: `read-only live/public snapshot present for ${String(snapshot.symbol)}` };
  }));

  const pass = checks.filter((c) => c.severity === "pass").length;
  const warn = checks.filter((c) => c.severity === "warn").length;
  const fail = checks.filter((c) => c.severity === "fail").length;

  writeFileSync(join(OUT, "outcome-audit.json"), JSON.stringify({ generatedAt: new Date().toISOString(), pass, warn, fail, checks }, null, 2) + "\n");
  writeFileSync(join(OUT, "outcome-audit.md"), [
    "# NightDesk Outcome Audit",
    "",
    `Pass: ${pass}`,
    `Warn: ${warn}`,
    `Fail: ${fail}`,
    "",
    "| Severity | Check | Detail |",
    "| --- | --- | --- |",
    ...checks.map((c) => `| ${c.severity.toUpperCase()} | ${c.name} | ${c.detail.replace(/\|/g, "\\|")} |`),
    "",
    "Interpretation: `FAIL` means the evidence pack is internally broken. `WARN` means the artifact is valid but the claim must be framed carefully in the pitch.",
  ].join("\n") + "\n");

  console.log("\nNightDesk Outcome Audit\n");
  for (const c of checks) {
    const mark = c.severity === "pass" ? "PASS" : c.severity === "warn" ? "WARN" : "FAIL";
    console.log(`${mark} ${c.name}: ${c.detail}`);
  }
  console.log(`\nsummary: ${pass} pass, ${warn} warn, ${fail} fail`);
  console.log(`report: ${join(OUT, "outcome-audit.md")}`);
  if (fail) process.exitCode = 1;
  return checks;
}

if (process.argv[1]?.endsWith("outcome-audit.ts")) runOutcomeAudit();
