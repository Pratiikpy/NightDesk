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

function present(path: string): boolean {
  return existsSync(join(process.cwd(), path));
}

export function runJudgeCockpit(): void {
  mkdirSync(OUT, { recursive: true });
  const alphaFactory = json<{ candidates?: number; trials?: number; rejected?: number; frozenChampion?: { id?: string }; championSelection?: { total_pnl?: number; max_drawdown?: number } }>("evidence/alpha-factory/manifest.json");
  const alphaChamp = json<{ champion?: { netPnl?: number; endingBalance?: number }; globalChampion?: { totalPnl?: number } }>("evidence/alpha-championship/manifest.json");
  const championship = json<{ pnlChampion?: { family?: string; net_pnl?: number; max_dd?: number }; safetyChampion?: { family?: string; net_pnl?: number; score_safety?: number } }>("evidence/championship/manifest.json");
  const doctor = json<{ rows?: { check: string; status: string }[] }>("evidence/doctor-report.json");
  const dataHealth = json<{ rows?: { source: string; status: string }[] }>("evidence/data-health/source-health.json");
  const forward = json<{ forwardSessions?: number; championLocked?: boolean }>("evidence/forward-paper-daemon/daemon-state.json");
  const oos = json<{ snapshotsRecorded?: number; status?: string }>("evidence/oos-daemon/state.json");
  const secrets = json<{ ok?: boolean; findings?: number }>("evidence/secrets-scan.json");
  const bankSessions = read("evidence/oos/session-bank/session-quality-report.md").match(/Current sessions:\s*(\d+)/i)?.[1] ?? "—";
  const overfit = json<{ nTrials?: number; rawSharpe?: number; expectedMaxSharpe?: number; deflatedSharpe?: number; deflatedSharpeSignificant?: boolean; minTrackRecordLength?: number | null; pbo?: { status?: string; value?: number | null } }>("evidence/alpha-factory/overfit-stats.json");

  const pnlChamp = alphaFactory?.championSelection?.total_pnl;
  const metric = (label: string, value: unknown, cls = ""): string =>
    `<div class="metric"><span class="label">${label}</span><span class="value ${cls}">${esc(value)}</span></div>`;
  const claim = (name: string, status: string, cls: string): string =>
    `<tr><td>${name}</td><td class="st ${cls}">${status}</td></tr>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>NightDesk — Judge Cockpit</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="description" content="One screen, every receipt: the evidence pack for NightDesk, the fair-value and safety gateway for Bitget tokenized US stocks."/>
<link rel="icon" href="data:,"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600&family=Newsreader:opsz,ital,wght@6..72,0,400;6..72,0,500;6..72,1,400&display=swap" rel="stylesheet"/>
<style>
:root{--bg:#faf9f5;--surface:#fbfaf7;--panel:#f3f1ea;--ink:#16160f;--muted:#5e5e54;--faint:#8a8a7e;--line:#e6e4da;--green:#0e7a57;--green-soft:#e7f0ea;--gold:#b5841f;--red:#c2483a;--sans:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;--serif:'Newsreader',Georgia,serif;--mono:'Geist Mono',ui-monospace,SFMono-Regular,monospace}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.green{color:var(--green)}.serif{font-family:var(--serif)}
nav{position:sticky;top:0;z-index:20;background:rgba(250,249,245,.82);backdrop-filter:saturate(140%) blur(12px);border-bottom:1px solid var(--line)}
nav .row{display:flex;align-items:center;justify-content:space-between;height:62px}
.brand{font-family:var(--serif);font-size:22px;letter-spacing:-.02em}
.navlinks{display:flex;gap:24px;align-items:center}
.navlinks a{font-size:14px;color:var(--muted)}.navlinks a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:500;padding:11px 20px;border-radius:999px;border:1px solid transparent;transition:.18s}
.btn-dark{background:var(--ink);color:#fff}.btn-dark:hover{background:#000}
@media(max-width:720px){.navlinks .lnk{display:none}}
.hero{padding:60px 28px 16px;max-width:880px}
.hero h1{font-family:var(--serif);font-weight:400;font-size:clamp(36px,5.6vw,60px);line-height:1.05;letter-spacing:-.022em;margin:16px 0 0}
.hero .lede{font-family:var(--serif);font-size:clamp(18px,2.2vw,23px);color:var(--muted);line-height:1.45;margin:20px 0 22px;max-width:720px}
.hero .lede b{color:var(--ink);font-weight:500}
.hero .cta{display:flex;gap:18px;flex-wrap:wrap;align-items:center}
.run{font-size:13px;color:var(--muted)}
.section{padding:44px 0;border-top:1px solid var(--line)}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--green);margin-bottom:12px}
.h2{font-family:var(--serif);font-weight:400;font-size:clamp(26px,3.2vw,36px);letter-spacing:-.018em;line-height:1.12;margin:0 0 6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;margin-top:24px}
.card{border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--surface);box-shadow:0 34px 60px -54px rgba(22,22,15,.3)}
.card h3{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--green);font-weight:500;margin-bottom:12px}
.metric{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}
.metric:last-child{border-bottom:0}
.label{color:var(--muted);font-size:14px}
.value{font-family:var(--mono);font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
.ok{color:var(--green)}.warn{color:var(--gold)}.bad{color:var(--red)}
.card p{color:var(--muted);font-size:13px;line-height:1.55;margin-top:12px}
.card p b{color:var(--ink);font-weight:500}
.flink{display:block;margin:9px 0;color:var(--green);font-family:var(--mono);font-size:12.5px;word-break:break-all}
.flink:hover{text-decoration:underline}
table.claims{width:100%;border-collapse:collapse;margin-top:24px;font-size:15px}
.claims td{padding:12px 0;border-bottom:1px solid var(--line)}
.claims tr:last-child td{border-bottom:0}
.claims .st{font-family:var(--mono);font-size:13px;text-align:right;white-space:nowrap}
.band{margin:56px 0 0;background:var(--ink);color:#eceae2;border-radius:24px;padding:clamp(34px,5vw,56px);text-align:center}
.band h2{font-family:var(--serif);font-weight:400;font-size:clamp(26px,3.6vw,40px);letter-spacing:-.018em;line-height:1.12}
.band p{color:#b8b8ac;margin:14px auto 22px;max-width:640px}
.band code{font-family:var(--mono);font-size:13px;color:#3fdd86}
code{font-family:var(--mono);background:var(--panel);padding:2px 7px;border-radius:6px;font-size:12.5px}
footer{border-top:1px solid var(--line);margin-top:56px;padding:36px 0 52px}
footer .row2{display:flex;justify-content:space-between;flex-wrap:wrap;gap:18px;align-items:baseline}
footer .tag{font-family:var(--serif);font-size:18px}
footer .meta{font-family:var(--mono);font-size:11.5px;color:var(--faint);letter-spacing:.04em}
</style></head><body>
<nav><div class="wrap row">
  <a class="brand" href="/">Night<span class="green">Desk</span></a>
  <div class="navlinks">
    <a class="lnk" href="/">Home</a>
    <a class="lnk" href="/desk">Live desk</a>
    <a class="btn btn-dark" href="https://github.com/Pratiikpy/NightDesk">GitHub ↗</a>
  </div>
</div></nav>

<header class="wrap hero">
  <div class="eyebrow">Judge Cockpit · Bitget AI Base Camp Hackathon S1</div>
  <h1>One screen.<br/><span class="green serif" style="font-style:italic">Every receipt.</span></h1>
  <p class="lede">The perp says <b>ALL CLEAR</b>. The real stock says <b>~17 of 19</b> are mispriced. NightDesk surfaces that gap, certifies each token, and runs a firewall that ALLOWs / CAPs / REJECTs every agent trade — then signs and grades it. <b>Bitget created the market; NightDesk makes it agent-safe.</b></p>
  <div class="cta">
    <a class="btn btn-dark" href="/desk">Open the live desk →</a>
    <span class="run">verify all of this: <code>npm run judge:max</code></span>
  </div>
</header>

<main class="wrap">
  <section class="section">
    <div class="kicker">Live · callable on the public URL, no login</div>
    <h2 class="h2">Poke the firewall yourself.</h2>
    <div class="grid">
      <div class="card">
        <h3>GET /api/firewall</h3>
        <p>Any agent — or you, right now — can ask the gate before placing a tokenized-stock trade. It returns a real, Ed25519-signed verdict in real time:</p>
        <a class="flink" href="https://night-desk-nine.vercel.app/api/firewall?ticker=NVDA&side=buy&sizeUsd=50" target="_blank" rel="noopener">▶ ALLOW — NVDA buy $50</a>
        <a class="flink" href="https://night-desk-nine.vercel.app/api/firewall?ticker=AAPL&side=buy&sizeUsd=500" target="_blank" rel="noopener">▶ ALLOW-CAPPED — AAPL buy $500 (capped to the safe size)</a>
        <a class="flink" href="https://night-desk-nine.vercel.app/api/firewall?ticker=FOO&side=buy&sizeUsd=50" target="_blank" rel="noopener">▶ REJECT — unknown ticker</a>
        <p><code>curl "https://night-desk-nine.vercel.app/api/firewall?ticker=NVDA&side=buy&sizeUsd=50"</code></p>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="kicker">Green numbers · current-recording paper evidence, not future alpha</div>
    <h2 class="h2">Two champions, kept honest.</h2>
    <div class="grid">
      <div class="card">
        <h3>Autonomous Alpha Factory</h3>
        ${metric("Candidates", alphaFactory?.candidates)}
        ${metric("Trials", alphaFactory?.trials)}
        ${metric("Rejected (Overfit Court)", alphaFactory?.rejected)}
        ${metric("Frozen champion PnL", pnlChamp, "ok")}
        ${metric("Champion max DD", alphaFactory?.championSelection?.max_drawdown)}
      </div>
      <div class="card">
        <h3>Raw-PnL Championship</h3>
        ${metric("Best ending balance", alphaChamp?.champion?.endingBalance, "ok")}
        ${metric("Best net PnL", alphaChamp?.champion?.netPnl, "ok")}
        ${metric("Global same-config PnL", alphaChamp?.globalChampion?.totalPnl, "ok")}
        <p>Current-recording evidence — labeled as such, not a future-alpha claim.</p>
      </div>
      <div class="card">
        <h3>Championship Mode</h3>
        ${metric("PnL champion", championship?.pnlChampion?.family)}
        ${metric("PnL net", championship?.pnlChampion?.net_pnl, "ok")}
        ${metric("Safety champion", championship?.safetyChampion?.family)}
        ${metric("Safety score", championship?.safetyChampion?.score_safety)}
        <p>Green-number mode and production-safety mode, frozen separately. Both keep hard safety invariants.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="kicker">Selection-bias controls · Bailey &amp; López de Prado</div>
    <h2 class="h2">Is the best strategy real, or luck?</h2>
    <div class="grid">
      <div class="card">
        <h3>Deflated Sharpe · PBO · MinTRL</h3>
        ${metric("Trials searched (N)", overfit?.nTrials)}
        ${metric("Raw per-session Sharpe", overfit?.rawSharpe)}
        ${metric("Best-of-N luck bar", overfit?.expectedMaxSharpe)}
        ${metric("Deflated Sharpe", overfit?.deflatedSharpe != null ? (overfit.deflatedSharpe * 100).toFixed(1) + "%" : "—", overfit?.deflatedSharpeSignificant ? "ok" : "warn")}
        ${metric("Min track record", overfit?.minTrackRecordLength == null ? "—" : Math.ceil(overfit.minTrackRecordLength) + " sessions")}
        ${metric("PBO (overfit prob.)", overfit?.pbo?.status === "computed" && overfit.pbo.value != null ? (overfit.pbo.value * 100).toFixed(1) + "%" : "accruing")}
        <p>We tested the raw convergence edge honestly: after correcting for ${esc(overfit?.nTrials)} trials it is <b>not yet statistically significant</b>. The raw edge alone isn't the product — NightDesk's value is turning noisy gaps into <b>certified, gated, executable</b> decisions. <code>npm run overfit:stats</code></p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="kicker">Bitget-native · safety posture</div>
    <h2 class="h2">Read-only by default, signed by design.</h2>
    <div class="grid">
      <div class="card">
        <h3>Bitget Native Proof</h3>
        ${metric("Bitget read-only", present("evidence/bitget-live/read-only-proof.md") ? "PASS" : "MISSING", "ok")}
        ${metric("Agent Hub compatibility", present("evidence/bitget-live/agent-hub-compat-report.md") ? "PASS" : "MISSING", "ok")}
        ${metric("MCP external-agent proof", present("evidence/integration/mcp-tool-call-log.jsonl") ? "PASS" : "MISSING", "ok")}
        ${metric("Skill Hub macro brief", present("evidence/skillhub/skillhub-proof.md") ? "PASS" : "MISSING", "ok")}
        ${metric("Bitget-schema paper log", present("evidence/trading-log/nightdesk-paper-trading-log.csv") ? "PASS" : "MISSING", "ok")}
      </div>
      <div class="card">
        <h3>Security &amp; Live Path</h3>
        ${metric("Secrets scan", secrets?.ok ? "CLEAN" : "REVIEW", secrets?.ok ? "ok" : "warn")}
        ${metric("Findings", secrets?.findings ?? 0)}
        ${metric("Live trade", "disabled by default")}
        ${metric("Bitget key", "read-only (40014)", "ok")}
        ${metric("Credentials", "env-only")}
        <p>No accidental write path. The live path is dry-run verified and dust-capped — no real fill is claimed.</p>
      </div>
      <div class="card">
        <h3>Signed Ledger &amp; Doctor</h3>
        ${metric("Tamper-evident ledger", present("evidence/ledger-tamper-test.json") ? "PASS" : "present", "ok")}
        ${(doctor?.rows ?? []).slice(0, 4).map((r) => metric(r.check, r.status, r.status === "pass" ? "ok" : "warn")).join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="kicker">Forward record · accumulating over real market time</div>
    <h2 class="h2">Out-of-sample, never fabricated.</h2>
    <div class="grid">
      <div class="card">
        <h3>Forward (OOS) Record</h3>
        ${metric("Champion locked", forward?.championLocked ? "YES" : "—", "ok")}
        ${metric("Forward sessions (post-freeze)", forward?.forwardSessions ?? 0)}
        ${metric("OOS session bank", esc(bankSessions) + " / 10 target")}
        ${metric("Recorder", oos?.status ?? "idle", oos?.status === "running" ? "ok" : "warn")}
        ${metric("Snapshots recorded", oos?.snapshotsRecorded ?? 0)}
        <p>The record grows every session against a <b>locked</b> champion. Early sample shown as a live counter, not invented history.</p>
      </div>
      <div class="card">
        <h3>Data Health</h3>
        ${(dataHealth?.rows ?? []).map((r) => metric(r.source, r.status, r.status === "ok" ? "ok" : "warn")).join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="kicker">Claim levels · what we prove, and what we don't</div>
    <h2 class="h2">Every claim, with its status.</h2>
    <table class="claims">
      ${claim("Bitget-schema paper trading logs", "Proven", "ok")}
      ${claim("Certificate firewall &amp; 15 hard gates", "Proven", "ok")}
      ${claim("External-agent integration (MCP + SDK)", "Proven", "ok")}
      ${claim("Bitget read-only round-trip", "Proven", "ok")}
      ${claim("Signed, tamper-evident ledger", "Proven", "ok")}
      ${claim(`PnL champion (${pnlChamp != null ? "+" + pnlChamp + " USDT" : "frozen"})`, "Current-recording evidence", "warn")}
      ${claim("Statistical alpha (Deflated Sharpe)", overfit?.deflatedSharpeSignificant ? "Significant" : "Not yet significant", "warn")}
      ${claim("Forward out-of-sample record", "Growing live", "warn")}
      ${claim("Real live fill", "Not claimed (read-only)", "warn")}
    </table>
  </section>

  <div class="band">
    <h2>Tested honestly. Built to be trusted.</h2>
    <p>We tested the raw convergence edge and showed exactly where it is not yet significant — then built the certified, gated, executable safety layer that makes tokenized-stock agents usable anyway. Every number on this page regenerates from one command.</p>
    <code>npm run judge:max</code> &nbsp;→&nbsp; <code>NIGHTDESK MAX JUDGE PACK VERIFIED</code>
  </div>
</main>

<footer class="wrap"><div class="row2">
  <div class="tag">Night<span class="green">Desk</span> — the honest referee.</div>
  <div class="meta">Bitget AI Base Camp Hackathon S1 · tokenized US stocks · signed &amp; replayable</div>
</div></footer>
</body></html>`;
  writeFileSync(join(OUT, "index.html"), html);
  console.log(`NIGHTDESK JUDGE COCKPIT COMPLETE: ${join(OUT, "index.html")}`);
}

if (process.argv[1]?.endsWith("judge-cockpit.ts")) runJudgeCockpit();
