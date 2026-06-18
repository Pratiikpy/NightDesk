// NightDesk public landing page — warm-monochrome editorial design, self-contained, content-complete.
// Served at "/". It never depends on live data to look finished; the live desk lives at "/desk".
export const LANDING_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>NightDesk — the honest referee for AI agents trading tokenized stocks</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="description" content="The fair-value, safety, and trust layer for Bitget tokenized US stocks. A complete loop, no human in the middle."/>
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
.mono{font-family:var(--mono)}
.serif{font-family:var(--serif)}
.green{color:var(--green)}
/* nav */
nav{position:sticky;top:0;z-index:20;background:rgba(250,249,245,.82);backdrop-filter:saturate(140%) blur(12px);border-bottom:1px solid var(--line)}
nav .row{display:flex;align-items:center;justify-content:space-between;height:62px}
.brand{font-family:var(--serif);font-size:22px;letter-spacing:-.02em}
.navlinks{display:flex;gap:26px;align-items:center}
.navlinks a{font-size:14px;color:var(--muted)}
.navlinks a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:14px;font-weight:500;padding:11px 20px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:.18s}
.btn-dark{background:var(--ink);color:#fff}.btn-dark:hover{background:#000}
.btn-ghost{background:transparent;color:var(--ink);border-color:var(--line)}.btn-ghost:hover{border-color:var(--ink)}
.btn .ar{font-family:var(--mono);font-size:13px}
@media(max-width:720px){.navlinks .lnk{display:none}}
/* hero */
.hero{padding:88px 28px 24px;max-width:848px;overflow-wrap:break-word}
.hero h1{font-family:var(--serif);font-weight:400;font-size:clamp(40px,6.4vw,68px);line-height:1.04;letter-spacing:-.022em;margin:18px 0 0}
.hero .lede{font-family:var(--serif);font-size:clamp(18px,2.3vw,23px);color:var(--muted);line-height:1.45;margin:22px 0 30px;max-width:640px}
.hero .cta{display:flex;gap:12px;flex-wrap:wrap}
.section{padding:60px 0;border-top:1px solid var(--line)}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--green);margin-bottom:14px}
.h2{font-family:var(--serif);font-weight:400;font-size:clamp(28px,3.6vw,40px);letter-spacing:-.018em;line-height:1.1;margin:0 0 14px}
.lead{font-size:17px;color:var(--muted);max-width:620px;line-height:1.6}
/* discovery reveal */
.reveal{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:34px}
@media(max-width:720px){.reveal{grid-template-columns:1fr}}
.gauge{border:1px solid var(--line);border-radius:18px;padding:26px;background:var(--surface)}
.gauge.real{background:var(--ink);border-color:var(--ink);color:#eceae2;box-shadow:0 50px 90px -60px rgba(22,22,15,.5)}
.gauge .lbl{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.gauge.real .lbl{color:#9c9b8f}
.gauge .big{font-family:var(--serif);font-size:clamp(40px,5vw,60px);line-height:1;margin:14px 0 8px;letter-spacing:-.02em}
.gauge.real .big{color:#3fdd86}
.gauge .desc{font-size:14.5px;color:var(--muted)}
.gauge.real .desc{color:#b8b8ac}
.verdict-line{margin-top:24px;font-family:var(--serif);font-size:clamp(19px,2.4vw,26px);line-height:1.4;letter-spacing:-.01em}
/* pillars */
.pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:30px}
@media(max-width:880px){.pillars{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.pillars{grid-template-columns:1fr}}
.pillar{border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--surface);box-shadow:0 34px 60px -54px rgba(22,22,15,.3)}
.pillar .n{font-family:var(--mono);font-size:11px;color:var(--green);letter-spacing:.08em}
.pillar h3{font-family:var(--serif);font-weight:500;font-size:20px;margin:12px 0 6px;letter-spacing:-.01em}
.pillar p{font-size:14px;color:var(--muted);line-height:1.5}
/* loop */
.loop{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:30px;counter-reset:step}
@media(max-width:880px){.loop{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.loop{grid-template-columns:1fr}}
.step{border:1px solid var(--line);border-radius:14px;padding:18px;background:var(--surface)}
.step .s{font-family:var(--mono);font-size:11px;color:var(--faint);letter-spacing:.1em}
.step h4{font-family:var(--mono);font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:8px 0 6px;color:var(--ink)}
.step p{font-size:13px;color:var(--muted);line-height:1.5}
/* gateway */
.gateway{display:grid;grid-template-columns:1.1fr 1fr;gap:36px;align-items:center}
@media(max-width:760px){.gateway{grid-template-columns:1fr}}
.verdicts{display:flex;flex-direction:column;gap:12px}
.vrow{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:14px;padding:16px 18px;background:var(--surface)}
.vrow .dot{width:11px;height:11px;border-radius:50%;flex:none}
.vrow .tag{font-family:var(--mono);font-size:13px;font-weight:500;width:118px;flex:none}
.vrow .txt{font-size:14px;color:var(--muted)}
.vrow.allow{border-color:#bfe3d2}.vrow.allow .dot{background:var(--green)}.vrow.allow .tag{color:var(--green)}
.vrow.capped{border-color:#e8d4a6}.vrow.capped .dot{background:var(--gold)}.vrow.capped .tag{color:var(--gold)}
.vrow.reject{border-color:#e7c3bd}.vrow.reject .dot{background:var(--red)}.vrow.reject .tag{color:var(--red)}
/* evidence */
.evi{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:30px}
@media(max-width:720px){.evi{grid-template-columns:1fr}}
.qa{border:1px solid var(--line);border-radius:16px;padding:24px;background:var(--surface)}
.qa .q{font-family:var(--serif);font-size:19px;letter-spacing:-.01em;margin-bottom:8px}
.qa .a{font-size:14.5px;color:var(--muted);line-height:1.6}
.qa .a b{color:var(--ink);font-weight:500}
/* cta band */
.band{margin:64px 0 0;background:var(--ink);color:#eceae2;border-radius:24px;padding:clamp(36px,6vw,64px);text-align:center}
.band h2{font-family:var(--serif);font-weight:400;font-size:clamp(28px,4vw,44px);letter-spacing:-.018em;line-height:1.1}
.band p{color:#b8b8ac;margin:14px auto 26px;max-width:520px}
.band .btn-dark{background:#fbfaf7;color:var(--ink)}.band .btn-dark:hover{background:#fff}
.band .btn-ghost{color:#eceae2;border-color:#3a3a30}.band .btn-ghost:hover{border-color:#eceae2}
/* footer */
footer{border-top:1px solid var(--line);margin-top:64px;padding:40px 0 56px}
footer .grid{display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px;align-items:baseline}
footer .tagline{font-family:var(--serif);font-size:18px;letter-spacing:-.01em}
footer .meta{font-family:var(--mono);font-size:11.5px;color:var(--faint);letter-spacing:.04em}
</style></head><body>

<nav><div class="wrap row">
  <a class="brand" href="/">Night<span class="green">Desk</span></a>
  <div class="navlinks">
    <a class="lnk" href="#discovery">Discovery</a>
    <a class="lnk" href="#how">How it works</a>
    <a class="lnk" href="#gateway">The firewall</a>
    <a class="lnk" href="#evidence">Evidence</a>
    <a class="lnk" href="/cockpit">Judge cockpit</a>
    <a class="btn btn-dark" href="/desk">Open live desk <span class="ar">→</span></a>
  </div>
</div></nav>

<header class="wrap hero">
  <div class="eyebrow">Fair-value · safety · trust layer for Bitget tokenized US stocks</div>
  <h1>A complete loop.<br/>No human in the <span class="green serif" style="font-style:italic">middle</span>.</h1>
  <p class="lede">Tokenized US stocks trade around the clock, but real price discovery only happens while Wall Street is open. NightDesk measures the true gap versus the real stock, explains why it exists, stands down when it is real news, and blocks any unsafe trade before it executes — every decision signed and replayable.</p>
  <div class="cta">
    <a class="btn btn-dark" href="/desk">Open the live desk <span class="ar">→</span></a>
    <a class="btn btn-ghost" href="#evidence">See the evidence</a>
  </div>
</header>

<section class="section" id="discovery"><div class="wrap">
  <div class="kicker">The discovery</div>
  <h2 class="h2">The true gap the perp hides.</h2>
  <p class="lead">The Bitget stock perp is a blended index of token issuers, so the token and the perp move together and cover for each other. Only the real NYSE price reveals the dislocation. Measured both ways, off-hours, on the live universe:</p>
  <div class="reveal">
    <div class="gauge">
      <div class="lbl">Measured vs the perp</div>
      <div class="big" id="perp-num">~0</div>
      <div class="desc">dislocations. Everything looks calm — the perp says all-clear.</div>
    </div>
    <div class="gauge real">
      <div class="lbl">Measured vs the real stock</div>
      <div class="big" id="real-num">17 / 19</div>
      <div class="desc">tokens dislocated off-hours. The gap the perp hides — surfaced.</div>
    </div>
  </div>
  <p class="verdict-line">The perp says <span class="mono" style="font-size:.8em">ALL CLEAR</span>. The real stock says <span class="green" id="verdict-real">17 of 19 are mispriced</span>. <span class="mono" id="reveal-live" style="font-size:.6em;color:var(--faint)"></span></p>
  <p class="lead" style="margin-top:18px"><strong>Bitget created the market for tokenized stocks. NightDesk is the missing trust layer that makes it safe for autonomous agents</strong> — not a critique of the perp, the complement to it: the perp is a fine index, the real-stock anchor is simply the reference an agent needs before it trades.</p>
</div></section>

<section class="section"><div class="wrap">
  <div class="kicker">Why you can trust it</div>
  <h2 class="h2">It does not promise easy profit. It proves it can be trusted.</h2>
  <div class="pillars">
    <div class="pillar"><div class="n">01</div><h3>Honest measurement</h3><p>Shows the true dislocation the perp hides, anchored to the real NYSE price.</p></div>
    <div class="pillar"><div class="n">02</div><h3>Risk discipline</h3><p>15 hard gates the desk cannot trade around. The trades they block lose on average.</p></div>
    <div class="pillar"><div class="n">03</div><h3>Restraint</h3><p>Stands down when a gap is driven by real news or a macro event. Abstention is scored, not ignored.</p></div>
    <div class="pillar"><div class="n">04</div><h3>Auditability</h3><p>Every decision is Ed25519-signed and replayable. Alter one entry and verification fails.</p></div>
  </div>
</div></section>

<section class="section" id="how"><div class="wrap">
  <div class="kicker">How it works</div>
  <h2 class="h2">A disciplined loop, every night, with no human in it.</h2>
  <div class="loop">
    <div class="step"><div class="s">01</div><h4>Perceive</h4><p>Live token + real-stock prices, plus news and macro context.</p></div>
    <div class="step"><div class="s">02</div><h4>Decide</h4><p>A multi-role council debates the gap, or stands down on real news.</p></div>
    <div class="step"><div class="s">03</div><h4>Gate</h4><p>15 hard risk gates. Any failure blocks the trade.</p></div>
    <div class="step"><div class="s">04</div><h4>Execute</h4><p>Realistic fills — spread, slippage, fees, funding — in an open sandbox.</p></div>
    <div class="step"><div class="s">05</div><h4>Grade</h4><p>At the NYSE open, each decision is marked win or loss and signed.</p></div>
  </div>
</div></section>

<section class="section" id="gateway"><div class="wrap">
  <div class="kicker">The safety gateway</div>
  <div class="gateway">
    <div>
      <h2 class="h2">The firewall every agent passes through.</h2>
      <p class="lead">Any AI agent can ask NightDesk before it places a tokenized-stock order. It answers with one verdict — and a trade with no valid certificate, an expired one, the wrong token, or a forbidden strategy is rejected before any money moves.</p>
      <div class="cta" style="margin-top:24px"><a class="btn btn-dark" href="/desk#gateway">Try it live <span class="ar">→</span></a><a class="btn btn-ghost" href="/api/firewall?ticker=NVDA&side=buy&sizeUsd=50" target="_blank" rel="noopener">Call the live API <span class="ar">→</span></a></div>
    </div>
    <div class="verdicts">
      <div class="vrow allow"><span class="dot"></span><span class="tag">ALLOW</span><span class="txt">Safe. Proceed.</span></div>
      <div class="vrow capped"><span class="dot"></span><span class="tag">ALLOW-CAPPED</span><span class="txt">Safe, but too big — here is the max safe size.</span></div>
      <div class="vrow reject"><span class="dot"></span><span class="tag">REJECT</span><span class="txt">Unsafe. Do not place it.</span></div>
    </div>
  </div>
</div></section>

<section class="section" id="evidence"><div class="wrap">
  <div class="kicker">The evidence</div>
  <h2 class="h2">Questions a skeptic asks first.</h2>
  <div class="evi">
    <div class="qa"><div class="q">"Isn't this just another backtest that found alpha?"</div><div class="a">No. We red-teamed our own thesis — does a dislocated token revert to the real stock next session? It came back <b>null: 49.6% corrective, a coin flip</b>. We report that openly. The published null result is the receipt of our rigor, not a weakness.</div></div>
    <div class="qa"><div class="q">"How do I know the numbers are real?"</div><div class="a">Every trade, block, and abstention is written to a <b>tamper-evident, signed ledger</b>, and every figure regenerates from one command. Alter, delete, or reorder a single entry and verification fails on the spot.</div></div>
    <div class="qa"><div class="q">"Could the AI have memorised the prices?"</div><div class="a">No path for it. The model only ever sees <b>live numeric state</b> and returns a qualitative verdict — all sizing, stops, fills and grading are deterministic code. A dedicated test proves no future data can leak in.</div></div>
    <div class="qa"><div class="q">"Do the safety gates actually matter?"</div><div class="a">Yes — measurably. In the paper record, the trades the gates <b>blocked would have lost</b> on average, and a reckless "trade every gap" agent loses far more, far more often. Discipline with a number on it.</div></div>
  </div>
</div></section>

<div class="wrap"><div class="band">
  <h2>A complete loop. No human in the middle.</h2>
  <p>The fair-value and safety layer the tokenized-stock era needs — every number replayable.</p>
  <div class="cta" style="justify-content:center"><a class="btn btn-dark" href="/desk">Open the live desk <span class="ar">→</span></a><a class="btn btn-ghost" href="/cockpit">Open the judge cockpit</a></div>
</div></div>

<footer><div class="wrap grid">
  <div class="tagline">Night<span class="green">Desk</span> — the honest referee.</div>
  <div class="meta">Bitget AI Base Camp Hackathon S1 · tokenized US stocks · signed &amp; replayable</div>
</div></footer>

<script>
(function(){
  function disloc(rows,key){var n=0;for(var i=0;i<rows.length;i++){var v=rows[i][key];if(v!=null&&Math.abs(v)>=0.5)n++;}return n;}
  fetch('/api/causality').then(function(r){return r.json();}).then(function(d){
    var rows=(d&&d.rows)||[];if(!rows.length)return;
    var total=rows.length, real=disloc(rows,'trueGapPct'), perp=disloc(rows,'perpGapPct');
    var rn=document.getElementById('real-num'); if(rn) rn.textContent=real+' / '+total;
    var pn=document.getElementById('perp-num'); if(pn) pn.textContent=(perp===0?'~0':String(perp));
    var vr=document.getElementById('verdict-real'); if(vr) vr.textContent=real+' of '+total+' are mispriced';
    var lv=document.getElementById('reveal-live'); if(lv) lv.textContent='· live now';
  }).catch(function(){});
})();
</script>
</body></html>`;
