import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "shadow-gateway");

interface ArenaSummary {
  summary: {
    agent: string;
    fills: number;
    blocks: number;
    endingBalance: number;
    netPnlUsdt: number;
    maxDrawdownUsdt: number;
    log: string;
  }[];
}

interface ShadowRow {
  agent: string;
  actual_pnl: number;
  guarded_pnl: number;
  always_block_pnl: number;
  reckless_pnl: number;
  pnl_delta_guarded_minus_actual: number;
  drawdown_delta_guarded_minus_actual: number;
  blocks_added_by_gateway: number;
  missed_profit: number;
  blocked_loss: number;
  verdict: string;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: object[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))].join("\n") + "\n");
}

function loadSummary(): ArenaSummary {
  return JSON.parse(readFileSync(join(process.cwd(), "evidence", "agent-arena-v2", "arena-v2-summary.json"), "utf8")) as ArenaSummary;
}

function byAgent(summary: ArenaSummary): Map<string, ArenaSummary["summary"][number]> {
  return new Map(summary.summary.map((s) => [s.agent, s]));
}

export function runShadowGateway(): void {
  mkdirSync(OUT, { recursive: true });
  const map = byAgent(loadSummary());
  const baseAgents = [...map.keys()].filter((a) => !a.endsWith("_guarded") && !a.includes("nightdesk") && !a.includes("qwen"));
  const rows: ShadowRow[] = [];

  for (const agent of baseAgents) {
    const actual = map.get(agent);
    const guarded = map.get(`${agent}_guarded`);
    if (!actual || !guarded) continue;
    const delta = guarded.netPnlUsdt - actual.netPnlUsdt;
    const ddDelta = guarded.maxDrawdownUsdt - actual.maxDrawdownUsdt;
    rows.push({
      agent,
      actual_pnl: Number(actual.netPnlUsdt.toFixed(6)),
      guarded_pnl: Number(guarded.netPnlUsdt.toFixed(6)),
      always_block_pnl: 0,
      reckless_pnl: Number(actual.netPnlUsdt.toFixed(6)),
      pnl_delta_guarded_minus_actual: Number(delta.toFixed(6)),
      drawdown_delta_guarded_minus_actual: Number(ddDelta.toFixed(6)),
      blocks_added_by_gateway: Math.max(0, guarded.blocks - actual.blocks),
      missed_profit: Number(Math.max(0, actual.netPnlUsdt - guarded.netPnlUsdt).toFixed(6)),
      blocked_loss: Number(Math.max(0, guarded.netPnlUsdt - actual.netPnlUsdt).toFixed(6)),
      verdict: delta >= 0 || guarded.maxDrawdownUsdt < actual.maxDrawdownUsdt ? "gateway_helped_or_reduced_risk" : "gateway_reduced_profit_on_this_sample",
    });
  }

  writeCsv("actual-vs-guarded.csv", rows);
  writeCsv("missed-profit.csv", rows.map((r) => ({ agent: r.agent, missed_profit: r.missed_profit, note: "positive means the unrestricted path made more on this sample" })));
  writeCsv("blocked-loss.csv", rows.map((r) => ({ agent: r.agent, blocked_loss: r.blocked_loss, note: "positive means guarded path had better net PnL on this sample" })));
  writeFileSync(
    join(OUT, "counterfactual-trades.jsonl"),
    rows.map((r) => JSON.stringify({ type: "SHADOW_COUNTERFACTUAL", ...r })).join("\n") + "\n",
  );
  writeFileSync(
    join(OUT, "rule-breaks.md"),
    [
      "# Shadow Gateway",
      "",
      "Compares each external agent's unrestricted path against its NightDesk-guarded path, plus always-block and reckless baselines.",
      "",
      "| Agent | Actual PnL | Guarded PnL | Missed Profit | Blocked Loss | Verdict |",
      "|---|---:|---:|---:|---:|---|",
      ...rows.map((r) => `| ${r.agent} | ${r.actual_pnl.toFixed(4)} | ${r.guarded_pnl.toFixed(4)} | ${r.missed_profit.toFixed(4)} | ${r.blocked_loss.toFixed(4)} | ${r.verdict} |`),
      "",
      "This report intentionally shows when the gateway reduces raw PnL. The claim is safety-adjusted execution quality, not hiding missed winners.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK SHADOW GATEWAY COMPLETE: ${join(OUT, "actual-vs-guarded.csv")}`);
}

if (process.argv[1]?.endsWith("shadow-gateway.ts")) runShadowGateway();
