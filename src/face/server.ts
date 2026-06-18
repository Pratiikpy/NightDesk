// Public dashboard: zero-dependency HTTP server serving the NightDesk risk-desk terminal.
//
// What it surfaces (the judge-runnable "full loop" view) — each backed by its own JSON endpoint:
//   • Risk desk (/api/causality)  — per token: true gap vs the real-stock anchor (NYSE print, session-aware), the perp gap that
//                                    hides it, the classified CAUSE, and the resulting action.
//   • Quality board (/api/quality)— A–D reliability grade per tokenized stock (tracking/stability/
//                                    liquidity), read from the saved token-quality.json.
//   • Scorecard + judgment (/api/scorecard) — graded trades AND graded abstentions/blocked trades
//                                    (counterfactual: what the avoided trades would have done).
//   • Ledger proof (/api/verify)  — live Ed25519 signature + tamper-evidence status of today's ledger.
//   • Evidence (/api/evidence)    — honest backtest receipts + the latest real council transcript.
// Visual design: warm-monochrome editorial — cream surface, warm-black ink, a single green accent,
// Newsreader serif display + Geist / Geist Mono — matching the NightDesk brand.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { LANDING_PAGE } from "./landing";
import { runJudgeCockpit } from "./judge-cockpit";
import { collect } from "../pegwatch/collect";
import { buildScorecard, summarizeJudgment } from "../ledger/scorecard";
import { classifyGap } from "../perception/causality";
import { MarketEventProvider } from "../perception/events";
import { verifyLedgerFile } from "../ledger/verify";
import { DEFAULT_GATES } from "../gates/gates";
import { certifyToken, type TokenCert } from "../research/certify";
import { issueCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { CycleRecord } from "../ledger/ledger";

function todayLedger(): CycleRecord[] {
  const day = new Date().toISOString().slice(0, 10);
  const file = join(process.cwd(), "data", "ledger", `${day}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as CycleRecord);
}

// Headline evidence: the historical convergence study + the latest real council transcript.
function readEvidence() {
  const researchFile = join(process.cwd(), "data", "research", "history-study-1h.json");
  let study: any = null;
  if (existsSync(researchFile)) {
    try {
      study = JSON.parse(readFileSync(researchFile, "utf8"));
    } catch {
      /* ignore */
    }
  }
  const records = todayLedger();
  const withT = records.filter((r) => r.transcript && r.transcript.length);
  const latest = withT.length ? withT[withT.length - 1] : null;
  return {
    convergence: study?.convergenceCapture ?? null,
    outOfSample: study?.outOfSample ?? null,
    observations: study?.totalPremiumObservations ?? null,
    pairs: study?.pairsWithData ?? null,
    basis: study?.basisBacktest ?? null,
    control: study?.control ?? null,
    perpLeg: study?.perpLeg ?? null,
    council: latest ? { ticker: latest.ticker, decision: latest.proposal?.decision, transcript: latest.transcript } : null,
  };
}

// Risk-desk causality view — cached briefly so the dashboard never hammers the news/macro providers.
const eventProvider = new MarketEventProvider();
let causalityCache: { at: number; data: unknown } | null = null;
async function getCausality(): Promise<unknown> {
  if (causalityCache && Date.now() - causalityCache.at < 60_000) return causalityCache.data;
  const snap = await collect();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => eventProvider.contextFor(r.ticker, snap.ts))));
  const rows = snap.rows.map((r, i) => {
    const c = classifyGap(r, ctxs[i]!);
    return {
      ticker: r.ticker,
      rPrice: r.rToken?.mid ?? null,
      equityPrice: r.equity?.price ?? null,
      trueGapPct: c.trueGapPct,
      perpGapPct: c.perpGapPct,
      type: c.type,
      action: c.action,
      note: c.note,
      liquidity: (r.rToken?.bookLevels ?? 0) > 0 ? "L2" : r.rToken?.mid != null ? "quote" : "-",
    };
  });
  const macro = ctxs[0] && (ctxs[0] as any).macro;
  const data = { isoTime: snap.isoTime, macro: macro?.summary ?? null, macroActive: !!macro?.active, rows };
  causalityCache = { at: Date.now(), data };
  return data;
}

type CertEntry = { cert: TokenCert; anchorSource: "NYSE_LIVE" | "LAST_CLOSE" | "NONE"; anchorStale: boolean };
let certCache: { at: number; entries: Map<string, CertEntry> } | null = null;
async function certUniverse(): Promise<Map<string, CertEntry>> {
  if (certCache && Date.now() - certCache.at < 60_000) return certCache.entries;
  const snap = await collect();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => eventProvider.contextFor(r.ticker, snap.ts))));
  const entries = new Map<string, CertEntry>();
  snap.rows.forEach((r, i) => {
    entries.set(r.ticker, {
      cert: certifyToken(r, ctxs[i]!),
      anchorStale: r.equity == null,
      anchorSource: r.equity == null ? "NONE" : r.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
    });
  });
  certCache = { at: Date.now(), entries };
  return entries;
}

function readQuality(): { present: boolean; rows: unknown[] } {
  const file = join(process.cwd(), "data", "research", "token-quality.json");
  if (!existsSync(file)) return { present: false, rows: [] };
  try {
    return { present: true, rows: JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    return { present: false, rows: [] };
  }
}

function verifyToday(): unknown {
  const day = new Date().toISOString().slice(0, 10);
  const file = join(process.cwd(), "data", "ledger", `${day}.jsonl`);
  if (!existsSync(file)) return { present: false };
  try {
    return { present: true, ...verifyLedgerFile(file) };
  } catch (e) {
    return { present: false, error: (e as Error).message };
  }
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"/>
<title>NightDesk — risk desk for tokenized US stocks</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="icon" href="data:,"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet"/>
<style>
:root{--bg:#faf9f5;--surface:#fbfaf7;--panel:#f4f3ee;--ink:#16160f;--muted:#5e5e54;--faint:#8a8a7e;--line:#e6e4da;--green:#0e7a57;--gold:#b5841f;--red:#c2483a;--sans:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;--serif:'Newsreader',Georgia,serif;--mono:'Geist Mono',ui-monospace,SFMono-Regular,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1140px;margin:0 auto;padding:40px 24px 64px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(34px,5vw,52px);line-height:1.05;letter-spacing:-.022em;margin:10px 0 0}
h1 .accent{color:var(--green)}
.sub{font-family:var(--serif);font-size:clamp(16px,2vw,20px);color:var(--muted);max-width:660px;margin:14px 0 24px;line-height:1.45}
h2{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:40px 0 12px;font-weight:500}
.note{color:var(--muted);font-size:12.5px;margin:0 0 16px;max-width:780px;line-height:1.5}
code{font-family:var(--mono);background:var(--panel);padding:1px 6px;border-radius:6px;font-size:12px}
.pill{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;letter-spacing:.02em;padding:8px 15px;border-radius:999px;border:1px solid var(--line);background:var(--surface);margin-bottom:22px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--faint);flex:none}
.pill.ok{color:var(--green);border-color:#bfe3d2}.pill.ok .dot{background:var(--green)}
.pill.bad{color:var(--red);border-color:#e7c3bd}.pill.bad .dot{background:var(--red)}
.pill.warn{color:var(--gold);border-color:#e8d4a6}.pill.warn .dot{background:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:14px;margin:10px 0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:0 30px 55px -48px rgba(22,22,15,.28)}
.card .k{font-family:var(--mono);color:var(--faint);font-size:10.5px;text-transform:uppercase;letter-spacing:.1em}
.card .v{font-family:var(--mono);font-size:26px;font-weight:500;margin-top:6px;font-variant-numeric:tabular-nums;color:var(--ink)}
.card .v.counter{color:var(--green)}
table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
th,td{text-align:right;padding:9px 12px;border-bottom:1px solid var(--line)}
th{font-family:var(--mono);color:var(--faint);font-weight:500;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em}
td{font-family:var(--mono)}
th:first-child,td:first-child{text-align:left}
tbody tr:hover{background:var(--panel)}
.pos{color:var(--green)}.neg{color:var(--red)}.amber{color:var(--gold)}.illusion{color:var(--gold);font-weight:500}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin:10px 0}
.evidence{box-shadow:0 40px 80px -64px rgba(22,22,15,.32)}
.evidence .row{display:flex;gap:34px;flex-wrap:wrap;align-items:baseline}
.evidence .big{font-family:var(--mono);font-size:30px;font-weight:500;color:var(--green);font-variant-numeric:tabular-nums}
.evidence .lbl{font-family:var(--mono);color:var(--faint);font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;margin-top:2px}
.evidence .cap{color:var(--muted);font-size:13px;margin-top:14px;line-height:1.55;max-width:840px}
.fw{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.fw input,.fw select{font-family:var(--mono);font-size:13px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)}
.btn{font-family:var(--sans);font-size:14px;font-weight:500;color:#fff;background:var(--ink);padding:11px 22px;border-radius:999px;border:0;cursor:pointer;transition:background .2s}
.btn:hover{background:#000}
.verdict{display:inline-flex;align-items:center;gap:10px;font-family:var(--mono);font-size:14px;font-weight:500;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--surface)}
.verdict.allow{color:var(--green);border-color:#bfe3d2}.verdict.allow .dot{background:var(--green)}
.verdict.capped{color:var(--gold);border-color:#e8d4a6}.verdict.capped .dot{background:var(--gold)}
.verdict.reject{color:var(--red);border-color:#e7c3bd}.verdict.reject .dot{background:var(--red)}
.fw-detail{font-family:var(--mono);font-size:12px;color:var(--muted);margin-top:8px}
.council{display:grid;gap:10px}
.deb{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--green);border-radius:12px;padding:13px 16px}
.deb .role{font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin-bottom:5px}
.deb .txt{font-size:13px;color:var(--ink);white-space:pre-wrap;line-height:1.5}
footer{font-family:var(--mono);color:var(--faint);font-size:11px;margin-top:36px;border-top:1px solid var(--line);padding-top:16px}
a{color:var(--green)}
</style></head><body><div class="wrap">
<div class="eyebrow">Live Desk · Bitget tokenized US stocks · <a href="/" style="color:var(--green)">home</a></div>
<h1>Night<span class="accent">Desk</span></h1>
<p class="sub">Tokenized stocks trade 24/7 while the NYSE sleeps. NightDesk measures the true gap versus the real stock, explains why it exists, and decides trade, abstain, or avoid — every decision signed and replayable. Auto-refresh 15s.</p>
<div id="verify" class="pill"><span class="dot"></span><span>checking signed ledger…</span></div>
<div id="risk" class="note"></div>
<div class="panel evidence" id="evidence"></div>
<div class="grid" id="cards"><div class="card"><div class="k">loading</div><div class="v">…</div></div></div>

<h2>Try the safety gateway — ask before you trade</h2>
<p class="note">Any agent can ask NightDesk before placing a tokenized-stock order: ALLOW · ALLOW-CAPPED (with the max safe size) · REJECT. Backed by <code>/api/firewall</code>.</p>
<div class="fw">
<input id="fw-ticker" value="NVDA" size="6" aria-label="ticker"/>
<select id="fw-side"><option value="buy">buy</option><option value="sell">sell</option></select>
<input id="fw-size" value="50" size="6" aria-label="size in USD"/>
<button class="btn" id="fw-go">Evaluate intent</button>
<span id="fw-verdict"></span>
</div>
<div id="fw-detail" class="fw-detail"></div>

<h2>Risk desk — true gap vs the REAL stock (the perp hides it)</h2>
<p class="note">true gap = rToken vs the real-stock anchor (latest NYSE print — live in market hours, last official close off-hours) · perp gap = vs the index that masks it · cause → action. Refreshes ~60s.</p>
<table id="riskdesk"><thead><tr><th>Ticker</th><th>rToken</th><th>NYSE</th><th>True gap</th><th>Perp gap</th><th>Cause</th><th>Action</th><th>Liq</th></tr></thead><tbody><tr><td>loading live market data…</td></tr></tbody></table>

<h2>Counterfactual judgment — we grade abstentions &amp; blocked trades too</h2>
<div id="judgment" class="note"></div>

<h2>Tokenized stock quality board — reliability grade (not alpha)</h2>
<p class="note">tracking 50% · stability 30% · liquidity 20%. Legal rights excluded — never fabricated. Run <code>npm run flags</code> to refresh.</p>
<table id="quality"><thead><tr><th>Ticker</th><th>Grade</th><th>Score</th><th>Track</th><th>Stable</th><th>Liquidity</th><th>Rights</th></tr></thead><tbody></tbody></table>

<h2>Latest autonomous council debate (Qwen)</h2>
<div class="council" id="council"></div>
<footer id="foot"></footer>
</div>
<script>
// All dynamic values are inserted via textContent / validated class names (no innerHTML of
// API-derived strings) to avoid any XSS surface.
const fmt=(n,d=2)=>n==null?'-':Number(n).toFixed(d);
const sign=(n,d=2)=>n==null?'-':(n>=0?'+':'')+fmt(n,d)+'%';
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e;}
const ACT={FADE:'pos',ABSTAIN:'amber',AVOID:'neg',NONE:''};
async function jget(u){try{const r=await fetch(u);if(!r.ok)return null;return await r.json();}catch(e){return null;}}
let lastActionable='…';let lastSc=null;
function renderCards(sc){
  const s=sc.scorecard;
  const cards=[
    ['Zero-intervention nights',sc.interventionFreeNights||0,'counter'],
    ['Trades graded',s.graded],
    ['Convergence',s.convergenceRatePct+'%'],
    ['Abstained',s.abstained||0],
    ['Actionable gaps now',lastActionable],
    ['Sim PnL',(s.totalSimPnl>=0?'+':'')+s.totalSimPnl],
  ];
  const cwrap=document.querySelector('#cards');cwrap.replaceChildren();
  for(const c of cards){const d=el('div',null,'card');d.appendChild(el('div',c[0],'k'));d.appendChild(el('div',c[1],c[2]?'v '+c[2]:'v'));cwrap.appendChild(d);}
}
async function tick(){
  // Fast local endpoints first — these paint immediately so the page is never blank.
  const [vf,rk]=await Promise.all([jget('/api/verify'),jget('/api/risk')]);
  if(rk){document.querySelector('#risk').textContent='Risk envelope — long-only · max '+rk.maxPositionPct+'%/position · max '+rk.maxGrossPct+'% gross · daily stop '+rk.maxDailyDrawdownPct+'% · net-edge gate (edge − fee − slippage ≥ '+rk.netEdgeMarginPct+'%) · '+rk.gateCount+' hard gates · '+(rk.riskOff?'⚠ RISK-OFF (high-macro day, standing down)':'risk-on');}
  if(vf){const vb=document.querySelector('#verify');vb.className='pill '+(!vf.present?'warn':(vf.signatureValid&&vf.tamperEvident?'ok':'bad'));vb.replaceChildren();vb.appendChild(el('span',null,'dot'));vb.appendChild(el('span',!vf.present?'no signed ledger yet — run npm run simulate':(vf.signatureValid&&vf.tamperEvident?('ledger signature VALID · tamper-evident · '+vf.recordCount+' records · pubkey#'+vf.publicKeyFingerprint):'ledger signature INVALID')));}
  const sc=await jget('/api/scorecard');
  if(sc){lastSc=sc;const j=sc.judgment;
    document.querySelector('#judgment').textContent=j?('Traded converged '+j.tradedConvergedPct+'% · abstained '+j.abstained.n+' (would-have-converged '+j.abstained.wouldHaveConvergedPct+'%, avg '+j.abstained.avgWouldBePnlPct+'pp) · gated '+j.gated.n+' (would-have-converged '+j.gated.wouldHaveConvergedPct+'%, avg '+j.gated.avgWouldBePnlPct+'pp). Abstained/gated converging LESS than traded = good judgment; negative gated pp = gates avoided losses.'):'No graded trades yet — run npm run simulate to generate the signed scorecard.';
    renderCards(sc);
  }
  // Slow live endpoint last — the risk desk keeps its loading row until this returns.
  const cz=await jget('/api/causality');
  const rd=document.querySelector('#riskdesk tbody');
  if(cz){
    rd.replaceChildren();let actionable=0;
    for(const r of (cz.rows||[])){
      if(r.type&&r.type!=='NONE'&&r.type!=='UNKNOWN')actionable++;
      const tr=document.createElement('tr');
      tr.appendChild(el('td',r.ticker));tr.appendChild(el('td',fmt(r.rPrice)));tr.appendChild(el('td',fmt(r.equityPrice)));
      tr.appendChild(el('td',sign(r.trueGapPct),r.trueGapPct==null?'':(Math.abs(r.trueGapPct)>=1.5?'neg':'')));
      tr.appendChild(el('td',sign(r.perpGapPct)));
      tr.appendChild(el('td',r.type,r.type==='PERP_ILLUSION'?'illusion':''));
      tr.appendChild(el('td',r.action,ACT[r.action]||''));tr.appendChild(el('td',r.liquidity));
      rd.appendChild(tr);
    }
    lastActionable=actionable+'/'+((cz.rows||[]).length);
    if(lastSc)renderCards(lastSc);
    const tok=lastSc?(lastSc.scorecard.llmPromptTokens+lastSc.scorecard.llmCompletionTokens):0;
    document.querySelector('#foot').textContent='Updated '+(cz.isoTime||'')+(cz.macroActive?' · HIGH macro day: desk stands down':'')+' · live market data · LLM tokens '+tok;
  }else if(!rd.querySelector('tr td:nth-child(2)')){rd.replaceChildren();const tr=document.createElement('tr');tr.appendChild(el('td','live market data unavailable right now — retrying…'));rd.appendChild(tr);}
}
async function loadQuality(){
  try{
    const q=await fetch('/api/quality').then(r=>r.json());
    const qb=document.querySelector('#quality tbody');qb.replaceChildren();
    if(q.present&&q.rows.length){
      for(const x of q.rows){
        const tr=document.createElement('tr');
        tr.appendChild(el('td',x.ticker));
        tr.appendChild(el('td',x.grade,x.grade==='A'||x.grade==='B'?'pos':(x.grade==='D'?'neg':'amber')));
        tr.appendChild(el('td',x.grade==='n/a'?'-':fmt(x.qualityScore,1)));
        tr.appendChild(el('td',x.components?x.components.tracking:'-'));
        tr.appendChild(el('td',x.components?x.components.stability:'-'));
        tr.appendChild(el('td',x.liquidity));
        tr.appendChild(el('td','not verified'));
        qb.appendChild(tr);
      }
    }else{
      const tr=document.createElement('tr');tr.appendChild(el('td','Run: npm run flags — to generate the quality board.'));qb.appendChild(tr);
    }
  }catch(e){/* ignore */}
}
async function loadEvidence(){
  try{
    const e=await fetch('/api/evidence').then(r=>r.json());
    const ev=document.querySelector('#evidence');ev.replaceChildren();
    if(e.control||e.convergence){
      const row=el('div',null,'row');
      const block=(big,lbl)=>{const d=document.createElement('div');d.appendChild(el('div',big,'big'));d.appendChild(el('div',lbl,'lbl'));return d;};
      if(e.control&&e.control.edgeOverRandom)row.appendChild(block((e.control.edgeOverRandom.basisPnlPct>=0?'+':'')+e.control.edgeOverRandom.basisPnlPct+'pp','basis edge over random'));
      if(e.perpLeg&&e.perpLeg.backtest)row.appendChild(block((e.perpLeg.backtest.totalPnlPct>=0?'+':'')+e.perpLeg.backtest.totalPnlPct+'%','tradeable perp leg'));
      if(e.observations)row.appendChild(block(Number(e.observations).toLocaleString(),'real observations'));
      if(e.pairs)row.appendChild(block(e.pairs,'rToken pairs'));
      ev.appendChild(row);
      const cap=[];
      if(e.control&&e.control.randomEntry)cap.push('Gap-fading beats a random-entry baseline; random entry loses '+e.control.randomEntry.basisPnlPct+'pp.');
      if(e.convergence&&e.control&&e.control.shuffledSeries)cap.push('We report the '+e.convergence.ratePct+'% convergence-capture as a distribution artifact (shuffle control '+e.control.shuffledSeries.captureRatePct+'%), not as edge.');
      cap.push('The LLM judges a live basis it could not have seen in training — no look-ahead/contamination. Reproduce: npm run backtest.');
      ev.appendChild(el('div',cap.join(' '),'cap'));
    } else {
      ev.appendChild(el('div','Run: npm run backtest — to generate the honest historical evidence (edge-over-random, controls).','cap'));
    }
    const co=document.querySelector('#council');co.replaceChildren();
    if(e.council&&e.council.transcript){
      for(const t of e.council.transcript){
        const d=el('div',null,'deb');
        d.appendChild(el('div',(t.role||'')+(e.council.ticker?' · '+e.council.ticker:''),'role'));
        d.appendChild(el('div',t.content,'txt'));
        co.appendChild(d);
      }
    } else {
      co.appendChild(el('div',null,'deb')).appendChild(el('div','No council debate yet — run: npx tsx src/index.ts simulate --live','txt'));
    }
  }catch(e){/* ignore */}
}
async function fw(){
  const t=(document.querySelector('#fw-ticker').value||'').toUpperCase().trim();
  const side=document.querySelector('#fw-side').value;
  const size=Number(document.querySelector('#fw-size').value||'0');
  const vEl=document.querySelector('#fw-verdict');const dEl=document.querySelector('#fw-detail');
  try{
    const r=await fetch('/api/firewall?ticker='+encodeURIComponent(t)+'&side='+side+'&sizeUsd='+size).then(x=>x.json());
    const map={ALLOW:'allow',ALLOW_CAPPED:'capped',REJECT:'reject'};const cls=map[r.verdict]||'reject';
    vEl.replaceChildren();const pill=el('span',null,'verdict '+cls);pill.appendChild(el('span',null,'dot'));pill.appendChild(el('span',(r.verdict||'REJECT').split('_').join('-')));vEl.appendChild(pill);
    const bits=[];if(r.reason)bits.push(r.reason);if(r.classification)bits.push('class '+r.classification);if(r.allowedPolicy)bits.push('policy '+r.allowedPolicy);if(r.maxSizeUsd!=null)bits.push('max $'+r.maxSizeUsd);if(r.safetyScore!=null)bits.push('safety '+r.safetyScore);
    dEl.textContent=bits.join('  ·  ');
  }catch(e){dEl.textContent='error: '+e;}
}
document.querySelector('#fw-go').addEventListener('click',fw);fw();
tick();setInterval(tick,15000);
loadQuality();setInterval(loadQuality,60000);
loadEvidence();setInterval(loadEvidence,20000);
</script></body></html>`;

export function startServer(port = Number(process.env.PORT) || 8787): void {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(LANDING_PAGE);
      } else if (req.url === "/desk" || req.url === "/desk.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(PAGE);
      } else if (req.url === "/cockpit" || req.url === "/cockpit.html") {
        const cockpit = join(process.cwd(), "evidence", "judge-cockpit", "index.html");
        if (!existsSync(cockpit)) runJudgeCockpit();
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(readFileSync(cockpit, "utf8"));
      } else if (req.url === "/api/pegwatch") {
        const snap = await collect();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snap));
      } else if (req.url === "/api/causality") {
        const data = await getCausality();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } else if (req.url === "/api/quality") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(readQuality()));
      } else if (req.url === "/api/verify") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(verifyToday()));
      } else if (req.url === "/api/risk") {
        const macroActive = !!(causalityCache?.data as { macroActive?: boolean } | undefined)?.macroActive;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            maxPositionPct: DEFAULT_GATES.maxPositionPct,
            maxGrossPct: DEFAULT_GATES.maxGrossPct,
            maxDailyDrawdownPct: DEFAULT_GATES.maxDailyDrawdownPct,
            maxSlippagePct: DEFAULT_GATES.maxSlippagePct,
            maxLeverage: DEFAULT_GATES.maxLeverage,
            netEdgeMarginPct: DEFAULT_GATES.netEdgeMarginPct,
            feeFloorPct: 0.32,
            longOnly: true,
            gateCount: 15,
            riskOff: macroActive,
          })
        );
      } else if (req.url && req.url.startsWith("/api/firewall")) {
        // Proof-carrying enforcement over HTTP — any external agent can POST/GET a trade intent.
        const u = new URL(req.url, "http://localhost");
        const ticker = (u.searchParams.get("ticker") || "").toUpperCase();
        const side = u.searchParams.get("side") === "sell" ? "sell" : "buy";
        const sizeUsd = Number(u.searchParams.get("sizeUsd") || "0");
        const entries = await certUniverse();
        const e = entries.get(ticker);
        res.writeHead(200, { "Content-Type": "application/json" });
        if (!e) {
          res.end(JSON.stringify({ verdict: "REJECT", reason: `unknown ticker ${ticker}` }));
        } else {
          const cert = issueCertificate(e.cert, { anchorSource: e.anchorSource, anchorStale: e.anchorStale });
          const dec = evaluateIntent({ ticker, side, sizeUsd, certificate: cert });
          res.end(JSON.stringify({ ...dec, classification: cert.payload.classification, allowedPolicy: cert.payload.allowedPolicy, safetyScore: cert.payload.safetyScore, maxSizeUsd: cert.payload.maxSizeUsd, certificateExpiresAt: cert.payload.expiresAt }));
        }
      } else if (req.url === "/api/scorecard") {
        const records = todayLedger();
        const scorecard = buildScorecard(records);
        const judgment = summarizeJudgment(records);
        // a night is intervention-free by construction (no manual override path in the loop)
        const interventionFreeNights = new Set(records.map((r) => new Date(r.ts).toISOString().slice(0, 10))).size;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ scorecard, judgment, interventionFreeNights }));
      } else if (req.url === "/api/evidence") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(readEvidence()));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
      }
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("error: " + (e as Error).message);
    }
  });
  server.listen(port, () => {
    console.log(`NightDesk dashboard → http://localhost:${port}`);
    console.log("  GET /              risk-desk terminal");
    console.log("  GET /api/causality true-gap + cause + action per token");
    console.log("  GET /api/quality   tokenized-stock quality board");
    console.log("  GET /api/scorecard scorecard + counterfactual judgment");
    console.log("  GET /api/verify    Ed25519 ledger verification status");
  });
}
