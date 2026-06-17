import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { envSecurityConfig, evaluateLiveTradeBoundary, evaluateShellToolBoundary } from "./boundaries";

const OUT = join(process.cwd(), "evidence", "security");

export function runSecurityReport(): void {
  mkdirSync(OUT, { recursive: true });
  const liveDefault = evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: false, notionalUsd: 1 }));
  const liveDust = evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, notionalUsd: 10, orderType: "limit", leverage: 1 }));
  const liveMarket = evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, notionalUsd: 10, orderType: "market", leverage: 1 }));
  const shellDefault = evaluateShellToolBoundary(envSecurityConfig({ enableShellTools: false }));
  const rows = [
    { boundary: "live_default", allowed: liveDefault.allowed, reason: liveDefault.reason },
    { boundary: "live_dust_limit", allowed: liveDust.allowed, reason: liveDust.reason },
    { boundary: "live_market_order", allowed: liveMarket.allowed, reason: liveMarket.reason },
    { boundary: "shell_default", allowed: shellDefault.allowed, reason: shellDefault.reason },
  ];
  writeFileSync(join(OUT, "security-boundaries.json"), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + "\n");
  writeFileSync(
    join(OUT, "security-boundaries.md"),
    [
      "# Security Boundaries",
      "",
      "| Boundary | Allowed | Reason |",
      "|---|---:|---|",
      ...rows.map((r) => `| ${r.boundary} | ${r.allowed} | ${r.reason} |`),
      "",
      "Rules: read-only by default, live trading disabled by default, live requires explicit opt-in, limit order, no leverage, and dust notional cap of 10 USDT.",
      "Secrets are never printed by this report.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK SECURITY REPORT COMPLETE: ${join(OUT, "security-boundaries.md")}`);
}

if (process.argv[1]?.endsWith("report.ts")) runSecurityReport();
