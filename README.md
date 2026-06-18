<div align="center">

<h1>NightDesk</h1>

<h3>Autonomous fair-value &amp; safety gateway for Bitget tokenized US stocks</h3>

<p>
  <a href="https://night-desk-nine.vercel.app"><img src="https://img.shields.io/badge/▶%20live%20demo-night--desk.vercel.app-16160f?style=flat-square" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/Bitget_AI_Hackathon_S1-Track_3-0e7a57?style=flat-square" alt="Bitget AI Hackathon S1 — Track 3">
  <img src="https://img.shields.io/badge/tests-215_passing-0e7a57?style=flat-square" alt="215 tests passing">
  <img src="https://img.shields.io/badge/license-MIT-b5841f?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/every%20number-reproducible-b5841f?style=flat-square" alt="Every number reproducible">
</p>

<p>
  <b>Live:</b> <a href="https://night-desk-nine.vercel.app">night-desk-nine.vercel.app</a> —
  <a href="https://night-desk-nine.vercel.app">landing</a> ·
  <a href="https://night-desk-nine.vercel.app/desk">live desk</a> ·
  <a href="https://night-desk-nine.vercel.app/cockpit">judge cockpit</a>
</p>

<p>
  <b>A complete autonomous trading loop — no human in the middle.</b><br>
  It reads live prices, news &amp; macro · a Qwen council decides · 15 hard gates enforce risk ·<br>
  fills run through an open-source sandbox · every decision is graded at the NYSE open and Ed25519-signed.
</p>

<h3>The perp says <code>ALL&nbsp;CLEAR</code>. The real stock says <code>17&nbsp;of&nbsp;19</code> are mispriced.</h3>

<p>
  <a href="#the-discovery">The discovery</a> ·
  <a href="#verify-in-2-minutes">Verify in 2 min</a> ·
  <a href="#honest-by-design">Honesty</a> ·
  <a href="#real-on-platform-evidence">Evidence</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#use-it-the-firewall-in-20-lines">Use it</a>
</p>

</div>

---

## The discovery

**The gap the perp hides.** Tokenized US stocks (rAAPL, rNVDA, rTSLA…) trade **24/7**, but the real
stock only prices during **NYSE hours**. Off-hours they drift on thin liquidity retail can't arbitrage —
and the obvious second opinion, the Bitget stock **perp**, is a *blended issuer index* that co-moves with
the token and **conceals the gap.** Only the real-NYSE anchor reveals it. Measured both ways, live,
off-hours:

| Measured against | Dislocated tokens | Reading |
|---|:---:|---|
| the **perp** | **~0 / 19** | "all clear" — the perp says nothing's wrong |
| the **real stock** | **~17 / 19** | the true gap the perp was hiding |

Revealing that dislocation — and acting on it *safely* — is the whole product. **Traditional quant can't
do this:** it needs the real-stock anchor, event-aware abstention, and a hard safety layer, all at once.

**Bitget created this market; NightDesk makes it agent-safe.** This is the *complement* to the perp, not
a critique of it — the perp is a fine tradable index; the real-stock anchor is simply the reference an
autonomous agent needs before it places a trade.

## The autonomous loop

```
PERCEIVE  live token + real-NYSE anchor + per-stock news + macro calendar
DECIDE    a 7-seat Qwen council debates the gap — or stands down when it's real news
GATE      15 hard risk gates; any fail blocks the trade
EXECUTE   realistic fills (spread, slippage, fees, funding) in the open-source BitSim sandbox
GRADE     at the NYSE open: win/loss, written back to memory — 0 human interventions
```

Every proposed trade — NightDesk's own *or any external agent's* — must first clear a signed
**certificate firewall**: `ALLOW` · `ALLOW-CAPPED` (here's the max safe size) · `REJECT`.

**The research half is just as autonomous:** Alpha Factory → Overfit Court → frozen champion → forward
paper daemon → expected-vs-actual → promoter. Throughout, the **LLM proposes and reasons; deterministic,
tested code certifies, gates, executes, signs, and grades.** That split *is* the safety architecture —
not a limitation of how "agentic" it is.

## Verify in 2 minutes

```bash
npm install
npm run build      # typecheck (tsc --noEmit)
npm test           # 215 tests + property tests, fully network-free
npm run judge      # tests + signed-ledger / firewall / gauntlet repro pack -> "JUDGE PACK VERIFIED"
npm run judge:max  # tests + evidence-artifact checks + complete manifest
npm run dashboard  # the landing + live risk desk at http://localhost:8787
```

Node 18+ (native fetch). **Public market data needs no key.** The Qwen council runs via the hackathon
proxy (`.env`); offline, a deterministic council keeps the whole suite runnable with no key and no cost.
Deeper reproduction (`paper-replay`, `alpha:factory`, `live:trade-proof`, `skillhub:proof`, …) is listed
in `package.json` — several take 1–3 min each.

## Honest by design

NightDesk separates **research signal** from **execution proof**, and claims only what it can replay:

1. **Honest measurement** — it surfaces the true dislocation the perp hides (≈17 of 19 off-hours).
2. **Risk discipline** — 15 hard gates that *demonstrably* avoid losses: in the paper record, the trades
   the gates blocked would have lost on average, and a reckless "trade every gap" agent loses far more.
3. **Restraint** — it stands down on real news or a macro event; abstention is scored, not ignored.
4. **Auditability** — every decision is Ed25519-signed and replayable.
5. **Current-recording PnL** — a frozen **PnL champion (+54.93 USDT in-sample)** and a separate **Safety
   champion**, both routed through the firewall, kept apart on purpose.
6. **A live forward record** — accumulating out-of-sample against a *locked* champion over wall-clock
   market time (we show the live counter, never fabricated history).

And the reason you can trust those numbers: **we tested the raw edge honestly and report exactly where it
stops.** The biggest lie in AI trading is a lucky backtest dressed as a guaranteed edge — we did the opposite:

- **The raw convergence edge alone is not enough — and we say so.** Our look-ahead-safe test — does a
  dislocated token revert toward the real stock next session? — comes back **49.6% corrective, a coin
  flip** (`npm run backtest -- --daily`). So the product isn't the raw signal; it's the certified, gated,
  executable layer *around* it. Publishing that test is the *receipt* of the rigor.
- **We flag our own best-looking stat.** The ~93% "convergence-capture" rate is a distributional
  artifact (a shuffle control says so), and a live 100%-capture paper session still lost money.
  Convergence ≠ P&L.
- **We deflate our own champion for selection bias.** The Factory searches 9,720 strategies, so a raw
  Sharpe isn't enough — we compute the **Deflated Sharpe Ratio, PBO and Minimum Track Record Length**
  (Bailey & López de Prado) on the frozen trials. Honest result: after correcting for 9,720 trials the
  champion's Sharpe is **not yet significant** (`npm run overfit:stats`) — which is exactly why we call
  +54.93 in-sample evidence, not alpha.
- **No look-ahead is possible by construction.** The LLM only ever sees *real-time numeric state* and
  returns a *qualitative* verdict — all sizing, stops, fills, fees and grading are deterministic,
  type-safe code. A sentinel test (`test/lookahead.test.ts`) proves corrupting post-probe data changes
  no pre-probe signal (to 1e-9).

**So NightDesk is an honest fair-value, risk & safety desk.** Its value is turning noisy tokenized-stock
gaps into certified, gated, executable decisions — not promising a green curve. The green numbers are
labeled for exactly what they are: in-sample / early-forward execution evidence, not future alpha.

**Claim boundaries** — read these from us, not "discover" them (also on the live cockpit):

| Claim | Status |
|---|---|
| Bitget-schema paper trading logs | **Proven** |
| Certificate firewall + 15 hard gates | **Proven** |
| External-agent integration (MCP + SDK) | **Proven** |
| Bitget read-only round-trip | **Proven** |
| Signed, tamper-evident ledger | **Proven** |
| PnL champion (+54.93 USDT) | Current-recording paper evidence |
| Statistical alpha (Deflated Sharpe) | Not yet significant after deflation |
| Forward out-of-sample record | Growing live |
| Real live fill | Not claimed (read-only / dust only) |

## Real on-platform evidence

| What | How to see it | Result |
|---|---|---|
| **Paper trading** (Bitget-schema log) | `evidence/trading-log/` · `npm run paper-replay` | guarded replay `1,000.00 → 1,004.34 USDT`, 38 fills, every unsafe intent blocked |
| **Autonomous Alpha Factory** | `evidence/alpha-factory/` · `npm run alpha:factory` | 9,720 candidates, 48,600 trials, an Overfit Court, frozen champion **+54.93 USDT** / 6.33 DD (in-sample) |
| **Selection-bias controls** | `evidence/alpha-factory/overfit-court-stats.md` · `npm run overfit:stats` | Deflated Sharpe / PBO / MinTRL (Bailey & López de Prado) — champion *not yet significant* after the 9,720-trial correction, reported not hidden |
| **Raw-PnL championship** | `evidence/alpha-championship/` | single-session `1,000 → 1,034.61`; global same-config **+54.93 USDT** (current-recording, not future alpha) |
| **Real authenticated Bitget round-trip** | `evidence/live-receipt/` · `npm run live:trade-proof` | account probe `code 00000`; trade endpoint `40014: read-only key` — the path is real, the key can't trade (zero funds risk) |
| **Real Agent Hub Skill Hub usage** | `evidence/skillhub/` · `npm run skillhub:proof` | the official Bitget `macro-analyst` skill drives NightDesk's macro abstention via a drop-in `MacroWindow` |
| **Signed, tamper-evident ledger** | `npm run verify` · `npm run ledger:tamper-test` | Ed25519; mutation/deletion/reorder/signature-swap all fail verification |
| **Hostile / safety proofs** | `evidence/redteam/`, `evidence/gates/` · `npm run redteam` | 15 hostile intents → 0 unsafe allowed; 15 gates covered; property-fuzzed firewall |
| **Reproducible manifest** | `npm run judge:max` | tests + artifact checks + complete evidence manifest, all green |

## Use it: the firewall in 20 lines

Any agent can ask NightDesk before it places a tokenized-stock order — over HTTP, the SDK, or MCP:

```ts
import { NightDeskClient } from "./sdk/nightdesk-client";

const nd = new NightDeskClient("http://localhost:8787");
const intent = { ticker: "NVDA", side: "buy", sizeUsd: 50 } as const;
const verdict = await nd.evaluateIntent(intent);

if (verdict.verdict === "REJECT") throw new Error(verdict.reason);
const sizeUsd = nd.allowedSize(intent, verdict); // honour the cap
// Place the Bitget order with sizeUsd, and only sizeUsd.
```

The same surface is an MCP tool `evaluate_intent` (`npm run mcp`), so Claude, Cursor, Codex, or a Bitget
Agent Hub agent can route trades through the gateway. Contract in `AGENT_INTENT_SPEC.md`; runnable example
`npx tsx sdk/examples/external-agent.ts`.

**Or call it live, right now** — the firewall is deployed and callable on the public URL (no login), so a
judge or an agent can poke the gate and watch it issue a real, Ed25519‑signed verdict:

```bash
curl "https://night-desk-nine.vercel.app/api/firewall?ticker=NVDA&side=buy&sizeUsd=50"   # ALLOW
curl "https://night-desk-nine.vercel.app/api/firewall?ticker=AAPL&side=buy&sizeUsd=500"  # ALLOW_CAPPED
curl "https://night-desk-nine.vercel.app/api/firewall?ticker=FOO&side=buy&sizeUsd=50"     # REJECT
```

## How it uses Bitget

- **Bitget** — live public market data for all 19 pairs (rToken + blended-index perp + Ondo cross-check);
  **Qwen 3.6** powers the council via the hackathon proxy; **Playbook** hosts a deterministic convergence
  strategy as an on-platform backtest.
- **Agent Hub** — NightDesk is **read-only by default** (verified live: the key returns `40014`, no
  write permission, so it can never place an accidental trade) and consumes the **Agent Hub Skill Hub**
  `macro-analyst` skill in its loop. Live execution is a one-line, gated key-swap.
- **Free sources** — Yahoo (real stock price + per-stock news), SoSoValue (macro calendar). All anchored,
  never fabricated.

## Architecture

*Perceive → decide → execute → risk → grade.*

| Layer | Module | What it does |
|---|---|---|
| **PegWatch** | `src/pegwatch/` | Pure fair-value math vs the real-stock anchor; depeg classification (fee-net); sValue-aware triangulation |
| **Perception** | `src/perception/` | News + macro fusion, event-aware abstention; Skill-Hub-drop-in provider interface |
| **Council** | `src/council/`, `src/llm/` | 7-seat bull/bear/risk debate on qwen3.6-plus (mock for tests) → proposal or NO_TRADE, portfolio-manager veto |
| **Gates** | `src/gates/` | 15 hard risk gates (pre-trade + live); every evaluation logged |
| **BitSim** | `src/bitsim/` | Open-source fill sandbox: quote-first for rTokens, depth-aware for perps/Ondo; PnL, fees, funding |
| **Execution** | `src/execution/` | Enforced order state machine, modeled latency/slippage, deterministic IDs, signed paper exporter |
| **Safety Kernel** | `src/kernel/` | Signed, expiring certificates + proof-carrying firewall (`ALLOW` / `ALLOW_CAPPED` / `REJECT`) |
| **Alpha Factory** | `src/research/` | Strategy search, Overfit Court, walk-forward, frozen champion — every PnL labeled in-sample |
| **Ledger** | `src/ledger/` | Append-only, Ed25519-signed cycle records + counterfactual scorecard |
| **MCP + SDK** | `src/mcp/`, `sdk/` | `evaluate_intent`, `certify_token`, `score_universe`, HTTP client, runnable external-agent example |
| **Face** | `src/face/` | Landing page + live risk desk + Judge Cockpit |

`config/universe.json` is the single source of truth (live-verified): 19 basis pairs, 7 spot-only rTokens,
2 perp-only, 10 Ondo cross-checks. No symbols are hardcoded anywhere else.

## Beyond tokenized stocks

The reusable core of NightDesk is **broker- and asset-agnostic**. The trade-intent contract is
exchange-agnostic by design (`AGENT_INTENT_SPEC.md`), and the safety kernel that consumes it — the
**certificate firewall, the Ed25519-signed ledger, and the MCP/SDK gateway** — never assumes a venue.

- **Today** — the gateway is hardened on Bitget tokenized US stocks: the highest-risk surface, where the
  real anchor is closed most of the week and the perp hides the gap.
- **Tomorrow** — the same `evaluate_intent` contract fronts any Agent Hub market or broker. Swap the data
  adapter and the price anchor; the certificate, gates, ledger, and verdict stay identical.

Tokenized stocks are the first surface we proved it on, not the only one it fits — which is what makes
NightDesk **infrastructure a gate other agents pass through**, not one more single-market bot.

## Track fit

Judged together for all-tracks #1:

- **Trading Agent** — a complete autonomous perceive→decide→gate→execute→grade loop, zero human interventions.
- **Trading Infrastructure** — the certificate firewall, signed ledger, MCP tools + SDK, the open-source fill sandbox, and a reproducible evidence pack other agents pass through.
- **US Stock AI Trading** — the real-stock fair-value anchor, the perp-illusion discovery, gap causality, and a tokenized-stock quality board.

## Verified data traps

See `verification-log.md` for the full list — the ones that quietly break naïve builds:

- rToken ticker `usdtVolume` is garbage — never used. rToken L2 books are intermittent (~half live);
  BitSim is quote-first for rTokens, depth-aware for perps/Ondo. **No mid-price fantasy:** it refuses
  empty/crossed/stale books, records partial fills, and charges modeled spread, slippage, fees and
  funding. The perp leg is informational, not always an executable hedge — which is exactly why the
  *safety* layer is the production thesis and the PnL champion is labeled paper evidence.
- Ondo legs are total-return (price = underlying × sValue); the sValue adjustment hook is in place
  (v0 multiplier 1.0; real per-ticker multipliers are a documented, deferred step — never faked). The
  Ondo leg is a secondary cross-check; the primary anchor is the real-stock NYSE print.
- Premiums below the ~0.32% round-trip fee floor are flagged not-tradeable (fee-edge gate).
- Weekend: perps trade with real volume (tradeable); rToken spot is quote-only (measure-only).

> The convergence NightDesk trades resolves at the **NYSE open**, so seeing it play out needs a recording
> that spans off-hours → open. A few-second sim only proves the loop is mechanically correct (every
> round-trip honestly pays the spread), not the edge. Run the recorder across an open, then `simulate` it.

---

<div align="center">

<b><i>Honesty over hype — every number replayable.</i></b>

<sub>
<code>SUBMISSION.md</code> 200-word + 4-part description ·
<code>PROJECT.md</code> plain-language overview ·
<code>EVALUATION_STANDARD.md</code> claim boundaries ·
<code>docs/CLAIM_LEDGER.md</code> claim → evidence map · MIT
</sub>

</div>
