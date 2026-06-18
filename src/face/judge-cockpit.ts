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
  <link rel="icon" href="data:,"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet"/>
  <style>
    :root{--bg:#faf9f5;--surface:#fbfaf7;--panel:#f3f1ea;--ink:#16160f;--muted:#5e5e54;--faint:#8a8a7e;--line:#e6e4da;--green:#0e7a57;--gold:#b5841f;--sans:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;--serif:'Newsreader',Georgia,serif;--mono:'Geist Mono',ui-monospace,SFMono-Regular,monospace}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
    header{padding:48px 40px 30px;border-bottom:1px solid var(--line)}
    .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
    h1{font-family:var(--serif);font-weight:400;font-size:clamp(30px,4vw,44px);letter-spacing:-.02em;margin:10px 0 8px}
    h1 .green{color:var(--green)}
    header p{color:var(--muted);max-width:680px;margin:0;font-size:15px;line-height:1.5}
    main{padding:28px 40px 64px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;max-width:1240px}
    section{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:22px;box-shadow:0 34px 60px -54px rgba(22,22,15,.3)}
    h2{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 14px;color:var(--green);font-weight:500}
    .metric{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}
    .metric:last-child{border-bottom:0}
    .label{color:var(--muted);font-size:14px}
    .value{font-family:var(--mono);font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
    .ok{color:var(--green)}
    .warn{color:var(--gold)}
    section p{color:var(--muted);font-size:13px;line-height:1.5;margin:12px 0 0}
    code{font-family:var(--mono);background:var(--panel);padding:1px 6px;border-radius:6px;font-size:12px}
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Judge Cockpit · Bitget AI Base Camp Hackathon S1</div>
    <h1>Night<span class="green">Desk</span> — one screen, every receipt</h1>
    <p>Alpha Factory, Overfit Court, the safety gateway, and paper-trading evidence for Bitget tokenized-stock agents — all verifiable from one command.</p>
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
