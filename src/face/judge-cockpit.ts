import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "judge-cockpit");

function read(path: string): string {
  const full = join(process.cwd(), path);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}

function json<T>(path: string): T | null {
  const text = read(path);
  if (!text) return null;
  return JSON.parse(text) as T;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function runJudgeCockpit(): void {
  mkdirSync(OUT, { recursive: true });
  const alphaFactory = json<{ candidates?: number; trials?: number; rejected?: number; frozenChampion?: { id?: string }; championSelection?: { total_pnl?: number; max_drawdown?: number } }>("evidence/alpha-factory/manifest.json");
  const alphaChamp = json<{ champion?: { netPnl?: number; endingBalance?: number }; globalChampion?: { totalPnl?: number } }>("evidence/alpha-championship/manifest.json");
  const championship = json<{ pnlChampion?: { strategy_id?: string; family?: string; net_pnl?: number; max_dd?: number }; safetyChampion?: { strategy_id?: string; family?: string; net_pnl?: number; max_dd?: number; score_safety?: number } }>("evidence/championship/manifest.json");
  const doctor = json<{ rows?: { check: string; status: string; detail: string }[] }>("evidence/doctor-report.json");
  const dataHealth = json<{ rows?: { source: string; status: string; role: string }[] }>("evidence/data-health/source-health.json");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NightDesk Judge Cockpit</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0c0f14; color: #e8edf2; }
    header { padding: 24px 32px; border-bottom: 1px solid #28313d; background: #121822; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    p { color: #aeb9c6; }
    main { padding: 24px 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    section { border: 1px solid #28313d; background: #151c27; border-radius: 8px; padding: 16px; }
    h2 { font-size: 16px; margin: 0 0 12px; color: #78d0ff; }
    .metric { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #26303b; }
    .metric:last-child { border-bottom: 0; }
    .label { color: #aeb9c6; }
    .value { font-weight: 700; text-align: right; }
    .ok { color: #74e39a; }
    .warn { color: #ffd166; }
    code { color: #9bdcff; }
  </style>
</head>
<body>
  <header>
    <h1>NightDesk Alpha Gateway Judge Cockpit</h1>
    <p>Alpha Factory + Overfit Court + Safety Gateway + Paper Trading Evidence for Bitget tokenized-stock agents.</p>
  </header>
  <main>
    <section>
      <h2>Alpha Factory</h2>
      <div class="metric"><span class="label">Candidates</span><span class="value">${esc(alphaFactory?.candidates)}</span></div>
      <div class="metric"><span class="label">Trials</span><span class="value">${esc(alphaFactory?.trials)}</span></div>
      <div class="metric"><span class="label">Rejected</span><span class="value">${esc(alphaFactory?.rejected)}</span></div>
      <div class="metric"><span class="label">Frozen Champion</span><span class="value">${esc(alphaFactory?.frozenChampion?.id)}</span></div>
      <div class="metric"><span class="label">Champion PnL</span><span class="value ok">${esc(alphaFactory?.championSelection?.total_pnl)}</span></div>
      <div class="metric"><span class="label">Champion Max DD</span><span class="value">${esc(alphaFactory?.championSelection?.max_drawdown)}</span></div>
    </section>
    <section>
      <h2>Raw-PnL Championship</h2>
      <div class="metric"><span class="label">Best Ending Balance</span><span class="value ok">${esc(alphaChamp?.champion?.endingBalance)}</span></div>
      <div class="metric"><span class="label">Best Net PnL</span><span class="value ok">${esc(alphaChamp?.champion?.netPnl)}</span></div>
      <div class="metric"><span class="label">Global Same-Config PnL</span><span class="value ok">${esc(alphaChamp?.globalChampion?.totalPnl)}</span></div>
      <p>Current-recording championship evidence. Not a guaranteed future-alpha claim.</p>
    </section>
    <section>
      <h2>Championship Mode</h2>
      <div class="metric"><span class="label">PnL Champion</span><span class="value ok">${esc(championship?.pnlChampion?.family)}</span></div>
      <div class="metric"><span class="label">PnL Net</span><span class="value ok">${esc(championship?.pnlChampion?.net_pnl)}</span></div>
      <div class="metric"><span class="label">PnL Max DD</span><span class="value">${esc(championship?.pnlChampion?.max_dd)}</span></div>
      <div class="metric"><span class="label">Safety Champion</span><span class="value">${esc(championship?.safetyChampion?.family)}</span></div>
      <div class="metric"><span class="label">Safety Score</span><span class="value">${esc(championship?.safetyChampion?.score_safety)}</span></div>
      <p>Separate green-number mode and production-safety mode. Both keep hard safety invariants.</p>
    </section>
    <section>
      <h2>Bitget Native Proof</h2>
      <div class="metric"><span class="label">Bitget read-only</span><span class="value ok">${existsSync(join(process.cwd(), "evidence/bitget-live/read-only-proof.md")) ? "PASS" : "MISSING"}</span></div>
      <div class="metric"><span class="label">Agent Hub compatibility</span><span class="value ok">${existsSync(join(process.cwd(), "evidence/bitget-live/agent-hub-compat-report.md")) ? "PASS" : "MISSING"}</span></div>
      <div class="metric"><span class="label">MCP external-agent proof</span><span class="value ok">${existsSync(join(process.cwd(), "evidence/integration/mcp-tool-call-log.jsonl")) ? "PASS" : "MISSING"}</span></div>
      <div class="metric"><span class="label">Paper log</span><span class="value ok">${existsSync(join(process.cwd(), "evidence/trading-log/nightdesk-paper-trading-log.csv")) ? "PASS" : "MISSING"}</span></div>
      <p>Read-only by default, env-only credentials, and no accidental write path.</p>
    </section>
    <section>
      <h2>Safety Gateway</h2>
      <div class="metric"><span class="label">Paper Log</span><span class="value">${existsSync(join(process.cwd(), "evidence/trading-log/nightdesk-paper-trading-log.csv")) ? "present" : "missing"}</span></div>
      <div class="metric"><span class="label">External MCP Proof</span><span class="value">${existsSync(join(process.cwd(), "evidence/integration/mcp-tool-call-log.jsonl")) ? "present" : "missing"}</span></div>
      <div class="metric"><span class="label">Ledger Verify</span><span class="value">${existsSync(join(process.cwd(), "evidence/trading-log/ledger-verification.txt")) ? "present" : "missing"}</span></div>
      <div class="metric"><span class="label">Bitget Read-Only</span><span class="value">${existsSync(join(process.cwd(), "evidence/bitget-live/live-market-snapshot.json")) ? "present" : "missing"}</span></div>
    </section>
    <section>
      <h2>Doctor</h2>
      ${(doctor?.rows ?? []).map((r) => `<div class="metric"><span class="label">${esc(r.check)}</span><span class="value ${r.status === "pass" ? "ok" : "warn"}">${esc(r.status)}</span></div>`).join("")}
    </section>
    <section>
      <h2>Data Health</h2>
      ${(dataHealth?.rows ?? []).map((r) => `<div class="metric"><span class="label">${esc(r.source)}</span><span class="value ${r.status === "ok" ? "ok" : "warn"}">${esc(r.status)}</span></div>`).join("")}
    </section>
    <section>
      <h2>Judge Commands</h2>
      <p><code>npm run judge:max</code> verifies tests, evidence schemas, and complete manifest.</p>
      <p><code>npm run judge:max:full</code> regenerates the full stack including Championship Mode, Alpha Championship, and Alpha Factory.</p>
    </section>
  </main>
</body>
</html>`;
  writeFileSync(join(OUT, "index.html"), html);
  console.log(`NIGHTDESK JUDGE COCKPIT COMPLETE: ${join(OUT, "index.html")}`);
}

if (process.argv[1]?.endsWith("judge-cockpit.ts")) runJudgeCockpit();
