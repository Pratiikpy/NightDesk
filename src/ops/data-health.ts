import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "data-health");

interface SourceHealth {
  source: string;
  status: "ok" | "warn" | "missing";
  evidence: string;
  role: string;
}

function has(path: string): boolean {
  return existsSync(join(process.cwd(), path));
}

function snapshotSymbol(): string {
  const file = join(process.cwd(), "evidence", "bitget-live", "live-market-snapshot.json");
  if (!existsSync(file)) return "unknown";
  try {
    const json = JSON.parse(readFileSync(file, "utf8")) as { symbol?: string };
    return json.symbol ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function runDataHealth(): void {
  mkdirSync(OUT, { recursive: true });
  const rows: SourceHealth[] = [
    { source: "Bitget rToken quote", status: has("evidence/bitget-live/live-market-snapshot.json") ? "ok" : "missing", evidence: `symbol=${snapshotSymbol()}`, role: "live/public market proof" },
    { source: "Bitget smoke log", status: has("evidence/bitget-live/bitget-smoke-log.jsonl") ? "ok" : "warn", evidence: "evidence/bitget-live/bitget-smoke-log.jsonl", role: "read-only adapter proof" },
    { source: "Bitget public stream", status: has("evidence/data-platform/live-stream-smoke.json") ? "ok" : "warn", evidence: "evidence/data-platform/live-stream-smoke.json", role: "live ticker/book stream receipt" },
    { source: "Stream resilience", status: has("evidence/data-platform/stream-resilience-proof.json") ? "ok" : "missing", evidence: "evidence/data-platform/stream-resilience-proof.json", role: "reconnect/backfill/heartbeat/circuit proof" },
    { source: "Point-in-time store", status: has("evidence/data-platform/point-in-time-proof.json") ? "ok" : "missing", evidence: "evidence/data-platform/point-in-time-proof.json", role: "immutable replay and leakage proof" },
    { source: "Equity anchor consensus", status: has("evidence/data-platform/live-anchor-comparison.json") ? "ok" : "warn", evidence: "evidence/data-platform/live-anchor-comparison.json", role: "independent source agreement" },
    { source: "NYSE/Yahoo anchor", status: has("evidence/oos/session-summary.csv") ? "ok" : "warn", evidence: "evidence/oos/session-summary.csv", role: "fair-value anchor study" },
    { source: "Recorded snapshots", status: has("data/snapshots") ? "ok" : "missing", evidence: "data/snapshots/*.jsonl", role: "replay/OOS/alpha factory base" },
    { source: "Alpha Factory", status: has("evidence/alpha-factory/manifest.json") ? "ok" : "missing", evidence: "evidence/alpha-factory/manifest.json", role: "strategy research data" },
    { source: "Paper execution", status: has("evidence/trading-log/nightdesk-paper-trading-log.csv") ? "ok" : "missing", evidence: "evidence/trading-log/nightdesk-paper-trading-log.csv", role: "Bitget-required trading record" },
    { source: "Ledger", status: has("evidence/trading-log/ledger-verification.txt") ? "ok" : "missing", evidence: "evidence/trading-log/ledger-verification.txt", role: "tamper-evident audit" },
    { source: "Qwen council", status: process.env.BITGET_QWEN_API_KEY || process.env.QWEN_API_KEY ? "ok" : "warn", evidence: "env presence only; key not printed", role: "optional live council path" },
    { source: "MCP/SDK integration", status: has("evidence/integration/mcp-tool-call-log.jsonl") ? "ok" : "missing", evidence: "evidence/integration/mcp-tool-call-log.jsonl", role: "external-agent proof" },
  ];
  writeFileSync(join(OUT, "source-health.json"), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + "\n");
  writeFileSync(
    join(OUT, "source-health.md"),
    [
      "# Data Source Health Matrix",
      "",
      "| Source | Status | Role | Evidence |",
      "|---|---|---|---|",
      ...rows.map((r) => `| ${r.source} | ${r.status} | ${r.role} | ${r.evidence} |`),
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK DATA HEALTH COMPLETE: ${join(OUT, "source-health.json")}`);
}

if (process.argv[1]?.endsWith("data-health.ts")) runDataHealth();
