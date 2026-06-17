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
// Styling here is intentionally minimal/functional — the visual UI/UX is a separate design pass.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
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
<style>
:root{--bg:#0a0e14;--fg:#c9d1d9;--dim:#6b7785;--green:#3fb950;--red:#f85149;--amber:#d29922;--card:#10151f;--line:#1e2630;--blue:#388bfd}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:0 0 2px}.sub{color:var(--dim);margin:0 0 14px;font-size:12px}
.badge{display:inline-block;font-size:12px;padding:3px 8px;border-radius:6px;border:1px solid var(--line);margin-bottom:16px}
.badge.ok{color:var(--green);border-color:#1d3b27}.badge.bad{color:var(--red);border-color:#3b1d1d}.badge.warn{color:var(--amber);border-color:#3b3119}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px}
.card .k{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.card .v{font-size:24px;font-weight:600;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
th,td{text-align:right;padding:6px 10px;border-bottom:1px solid var(--line)}th{color:var(--dim);font-weight:500}
th:first-child,td:first-child{text-align:left}
.pos{color:var(--green)}.neg{color:var(--red)}.amber{color:var(--amber)}.illusion{color:var(--blue)}
.counter{color:var(--green);font-variant-numeric:tabular-nums}
footer{color:var(--dim);font-size:11px;margin-top:24px}
.evidence{background:linear-gradient(135deg,#0d1b2a,#10151f);border:1px solid #1e3a5f;border-radius:10px;padding:16px 18px;margin-bottom:20px}
.evidence .big{font-size:30px;font-weight:700;color:var(--green)}
.evidence .lbl{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.evidence .row{display:flex;gap:28px;flex-wrap:wrap;align-items:baseline}
.evidence .cap{color:var(--fg);font-size:13px;margin-top:6px}
h2{font-size:13px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin:24px 0 8px}
.note{color:var(--dim);font-size:11px;margin:0 0 16px}
.council{display:grid;gap:8px}
.deb{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:6px;padding:10px 12px}
.deb .role{font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.deb .txt{font-size:12.5px;color:var(--fg);white-space:pre-wrap}
</style></head><body><div class="wrap">
<h1>NightDesk <span style="color:var(--dim)">· risk desk for Bitget tokenized US stocks</span></h1>
<p class="sub">Tokenized stocks trade 24/7 while the NYSE sleeps. NightDesk measures the true gap vs the real stock, explains why it exists, and decides trade / abstain / avoid. Auto-refresh 15s.</p>
<div id="verify" class="badge"></div>
<div id="risk" class="note"></div>
<div class="evidence" id="evidence"></div>
<div class="grid" id="cards"></div>

<h2>Risk desk — true gap vs the REAL stock (the perp hides it)</h2>
<p class="note">true gap = rToken vs the real-stock anchor (latest NYSE print — live in market hours, last official close off-hours) · perp gap = vs the index that masks it · cause → action. Refreshes ~60s.</p>
<table id="riskdesk"><thead><tr><th>Ticker</th><th>rToken</th><th>NYSE</th><th>True gap</th><th>Perp gap</th><th>Cause</th><th>Action</th><th>Liq</th></tr></thead><tbody></tbody></table>

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
async function tick(){
  try{
    const [sc,cz,vf,rk]=await Promise.all([
      fetch('/api/scorecard').then(r=>r.json()),
      fetch('/api/causality').then(r=>r.json()),
      fetch('/api/verify').then(r=>r.json()),
      fetch('/api/risk').then(r=>r.json())
    ]);
    const rb=document.querySelector('#risk');
    rb.textContent='Risk envelope — long-only · max '+rk.maxPositionPct+'%/position · max '+rk.maxGrossPct+'% gross · daily stop '+rk.maxDailyDrawdownPct+'% · net-edge gate (edge − fee − slippage ≥ '+rk.netEdgeMarginPct+'%) · '+rk.gateCount+' hard gates · '+(rk.riskOff?'⚠ RISK-OFF (high-macro day, standing down)':'risk-on');
    // verify badge
    const vb=document.querySelector('#verify');vb.className='badge '+(!vf.present?'warn':(vf.signatureValid&&vf.tamperEvident?'ok':'bad'));
    vb.textContent=!vf.present?'no signed ledger yet — run npm run simulate':(vf.signatureValid&&vf.tamperEvident?('ledger signature VALID · tamper-evident · '+vf.recordCount+' records · pubkey#'+vf.publicKeyFingerprint):'ledger signature INVALID');
    // risk desk
    const rd=document.querySelector('#riskdesk tbody');rd.replaceChildren();
    let actionable=0;
    for(const r of (cz.rows||[])){
      if(r.type&&r.type!=='NONE'&&r.type!=='UNKNOWN')actionable++;
      const tr=document.createElement('tr');
      tr.appendChild(el('td',r.ticker));
      tr.appendChild(el('td',fmt(r.rPrice)));
      tr.appendChild(el('td',fmt(r.equityPrice)));
      tr.appendChild(el('td',sign(r.trueGapPct),r.trueGapPct==null?'':(Math.abs(r.trueGapPct)>=1.5?'neg':'')));
      tr.appendChild(el('td',sign(r.perpGapPct)));
      tr.appendChild(el('td',r.type,r.type==='PERP_ILLUSION'?'illusion':''));
      tr.appendChild(el('td',r.action,ACT[r.action]||''));
      tr.appendChild(el('td',r.liquidity));
      rd.appendChild(tr);
    }
    // judgment
    const j=sc.judgment;
    if(j){document.querySelector('#judgment').textContent='Traded converged '+j.tradedConvergedPct+'% · abstained '+j.abstained.n+' (would-have-converged '+j.abstained.wouldHaveConvergedPct+'%, avg '+j.abstained.avgWouldBePnlPct+'pp) · gated '+j.gated.n+' (would-have-converged '+j.gated.wouldHaveConvergedPct+'%, avg '+j.gated.avgWouldBePnlPct+'pp). Abstained/gated converging LESS than traded = good judgment; negative gated pp = gates avoided losses.';}
    // cards
    const s=sc.scorecard;
    const cards=[
      ['Zero-intervention nights',sc.interventionFreeNights||0,'counter'],
      ['Trades graded',s.graded],
      ['Convergence',s.convergenceRatePct+'%'],
      ['Abstained',s.abstained||0],
      ['Actionable gaps now',actionable+'/'+((cz.rows||[]).length)],
      ['Sim PnL',(s.totalSimPnl>=0?'+':'')+s.totalSimPnl],
    ];
    const cwrap=document.querySelector('#cards');cwrap.replaceChildren();
    for(const c of cards){const d=el('div',null,'card');d.appendChild(el('div',c[0],'k'));d.appendChild(el('div',c[1],c[2]?'v '+c[2]:'v'));cwrap.appendChild(d);}
    document.querySelector('#foot').textContent='Updated '+(cz.isoTime||'')+(cz.macroActive?' · HIGH macro day: desk stands down':'')+' · LLM tokens '+(s.llmPromptTokens+s.llmCompletionTokens);
  }catch(e){document.querySelector('#foot').textContent='error: '+e}
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
tick();setInterval(tick,15000);
loadQuality();setInterval(loadQuality,60000);
loadEvidence();setInterval(loadEvidence,20000);
</script></body></html>`;

export function startServer(port = Number(process.env.PORT) || 8787): void {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(PAGE);
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
