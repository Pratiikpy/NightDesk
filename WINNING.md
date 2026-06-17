# WINNING.md — NightDesk: the build that can't lose

**Bitget AI Base Camp Hackathon S1 · Track 3 submission, all-tracks #1 target**
**Author note (brutal, product-only): this is the consolidated war-plan. It merges (a) the live
competitor teardown, (b) NightDesk's *real* backtest numbers, and (c) the agentic-trading research
survey. Read §0 first — it overrides the instinct to "build everything."**

---

## 0. The thesis (this is the whole game)

> **"No fixed formula. The projects that stand out solve a real problem and actually run."**

In a *weak* field, the project that cannot lose is **not** the one with the most features. It is the
one where **every claim survives a trader-judge opening the repo.** Feature count is RUNECLAW's
trap, not a moat (81k LOC, 862 tests — and its headline backtest *loses money* and it requires a
human to confirm every trade, which breaks the event's one-sentence manifesto).

So the win condition is **unimpeachable rigor + a real problem + perfect manifesto fit + the empty
Track 3**, in that order. Every item below serves that, and anything that doesn't is cut.

The single most dangerous competitor to NightDesk winning is **not** RUNECLAW or adaptive-edge.
It is **NightDesk's own current "100% win rate" backtest metric**, which a quant judge will read as
naïve or dishonest. Fixing that is item #1 and it is existential.

---

## 1. The field, and why each rival loses (verified from their repos)

| Project | Track | Size | Fatal flaw a judge will find |
|---|---|---|---|
| **RUNECLAW** (Humanoid-Traders) | T1 crypto | 81k LOC, real Bitget micro-trade proof | **Mandatory human confirmation** ("the human decides") = breaks "no human in the middle"; 500-run backtest **loses** (avg −0.46%, Sharpe −1.24); crypto not stocks; feature sprawl reads AI-generated |
| **adaptive-edge** (Gacormek) | T1 crypto | 17k LOC, autonomous | Backtest is **fantasy**: +1830%, Sharpe 12.29, **536% max drawdown** (a blown account), 10x lev → dead on arrival with trader judges; `paper_portfolio.json` = 0 trades (no live track record); crypto not stocks |
| **haruspex** (phllp-tanstic) | T1 DeFi | ~1.2k LOC, genuinely autonomous | Clean + honest, but tiny surface, crypto/DeFi, not a stock or all-tracks contender |
| **signal-desk** (xiaomaolu) | T1 | ~2.9k LOC frontend | **No LLM** (rule-based; "add LLM" is a *next step*); no backend, no autonomy — a demo |
| **stock-chain-ai** (xiaomaolu) | **T3** | ~2.1k LOC frontend | Only other stock entry, but **explicitly uses DEMO data for stocks** and refuses to map tokenized symbols → scores ~0 on "uses Bitget US-stock data". No fair value, no depeg |
| **TrendOracle-Labs** (MrDilZ2214) | T1 | ~382 LOC | Vapor: README + docs only, no app code in repo |

**Takeaway: Track 3 is effectively uncontested for real tokenized-stock fair value, and every
serious all-tracks rival dies on the same sword — a PnL claim that doesn't survive scrutiny.**
The winning move is to *not be a PnL claim.*

---

## 2. NightDesk's real numbers (from `data/research/history-study-*.json`) — face them

- **Convergence capture 93% (1h) / 100% (1day):** largely a **mean-reversion tautology** of a noisy,
  stationary premium series. Avg narrowing ≈ 0.49pp — *below* the 0.32% round-trip fee floor. Not, by
  itself, a tradeable edge.
- **Basis backtest "100% win rate, +10.6%":** inflated by a **survivorship bug** in
  `basisBacktest()` (`src/history/study.ts`): a position only closes on reversion; non-converging
  positions are never closed and never counted as losses. 100% win-rate is the symptom.
- **Perp-leg (the genuinely tradeable leg): −14.45%, 41% win (1h).** When you trade the instrument
  that actually fills, you lose at retail costs.
- **Peg-tracking improvement −1.36% (1h) / +0.19% (1day):** the perp anchor is **no better than the
  rToken's own last price** at predicting its future. The literal "fair-value" claim is unsupported.
- **Signal concentration:** events are dominated by SQQQ/GME/TQQQ/CRCL/ORCL (leveraged ETFs + meme
  names); AAPL/NVDA/MSFT/AMZN/META/SPY/QQQ have 0–2 events each.

**Conclusion: as a "profitable trading bot," NightDesk has no demonstrated edge. As the most
HONEST, rigorous, autonomous *measurement + risk + execution-infrastructure layer* on real
tokenized-stock data, it has no equal in this field.** Pivot the center of gravity accordingly.

---

## 3. The seven existential product fixes (do these or don't bother)

1. **Fix the backtest honesty — EXISTENTIAL.** In `basisBacktest()` close non-converging positions
   at a time-stop / mark-to-end so losers are counted. Publish the *real* win rate (even 55%) and PnL
   (even negative). A credible thin/negative edge beats a fantasy 100%. This flips your evidence from
   *liability under scrutiny* to *the most honest numbers in the competition.*
2. **Lead with the tradeable perp-leg result, framed right:** "the fillable edge is thin/negative at
   retail costs — which is exactly why this is a measurement-and-risk layer, not a get-rich bot."
   This disarms every quant judge and makes you the only adult in the room.
3. **Get a real underlying-equity anchor, or stop saying "fair value."** Tracking error says the perp
   ≈ naïve persistence. Either pull a free/delayed real stock quote so fair value is genuinely the
   stock, or rename the thesis to **"cross-venue basis monitor."** Never claim what your data denies.
4. **Ship BitSim as a standalone MIT repo + one-line MCP.** Today it's a folder (`src/bitsim/`). The
   "foundational infrastructure" crown — your path to *all-tracks* not just Track 3 — requires it to
   be something other teams can `npx`/import in 5 minutes.
5. **Make PegWatch a genuine public good** — the only live fair-value/depeg board for Bitget
   tokenized stocks, running and recording continuously. Real, uncontested utility, independent of any
   trading claim.
6. **Wire one real perception source, or admit the council is the veto/explainability layer.**
   Today `src/perception/provider.ts` ships `Null` providers and the loop is
   "premium > threshold → LLM rubber-stamp." Either feed it one real input (news/macro via Skill Hub)
   so the council debates something real, or state plainly that the deterministic basis signal is the
   engine and the council is the audited risk/veto layer.
7. **One real perp micro-trade** (perps are tradeable) to match RUNECLAW's only genuine evidence
   edge. Optional, converts "sim" → "it traded." Needs a trade-enabled key + explicit go-ahead.

---

## 4. The research-derived moat — what makes us *un-attackable* (this is the new material)

The pasted survey is, conveniently, the exact rubric a sophisticated judge (Foresight VC / Qwen
researcher / Dune's Filippo) uses to separate "toy" from "institutional." NightDesk already satisfies
most of it. Make it explicit; close the rest.

### 4.1 Look-ahead bias & pre-training contamination — turn the #1 threat into our #1 flex
The research's central validity threat: LLMs "remember" the price paths of the periods they backtest
(Look-Ahead-Bench, *Alpha Decay* = α_P2 − α_P1; standard models collapse >15pp out-of-sample).
**Our defense is structural and almost unique here:** NightDesk's edge is a **deterministic basis
signal** (`fairvalue.ts`, pure math), *not* the LLM predicting prices. The LLM never forecasts a
chart it might have memorized — it only judges a *live premium number it cannot have seen in
training.* 
- **Action:** add a one-paragraph "Look-ahead & contamination statement" to the README + dashboard:
  "Our signal is a live cross-instrument basis, not LLM price recall. The LLM receives only
  real-time numeric state and emits a qualitative JSON verdict; it has no path to leak future prices.
  Backtests are walk-forward, out-of-sample split, network-disabled and deterministic."
- This is the single highest-credibility sentence you can say to this judging panel. No rival can say it.

### 4.2 Isolate cognitive vs execution layers — the research's #1 recommendation, already shipped
Research: *"Restrict LLMs to qualitative tasks… position sizing, stops, margin must be deterministic
type-safe code."* NightDesk: `fairvalue.ts` (math) + `gates/gates.ts` (deterministic risk) +
`bitsim/` (deterministic fills) + council emits only structured JSON. **You already implement the
recommended architecture.** Name it exactly that in the writeup.

### 4.3 The Compliance Gatekeeper Pattern — name it, and add signing
Research describes the institutional pattern: Research agent (no keys) → emits *Trade Intent* →
deterministic Compliance/Risk agent checks limits + **digitally signs** → Execution → **immutable
audit ledger.** NightDesk *is* this: council (no keys) → `preTradeGates` (15 Hard Gates, incl. gate
12 kill-switch) → BitSim → append-only `ledger/ledger.ts`.
- **Action:** add **Ed25519 signing of each ledger cycle** (RUNECLAW has attestation; this matches
  it cheaply) and label the architecture "Compliance Gatekeeper Pattern" in the README diagram.
  Maps directly to the regulatory pillars (active supervision, MiFID II kill switch, immutable audit
  trails, market-conduct safeguards) the research lists — Vlad (EVEDEX CTO) and Henry (Kite) score this.

### 4.4 Prove the signal isn't an artifact — robustness / random baseline (Rademacher-lite)
The research demands you prove alpha isn't statistical noise (Rademacher Anti-Serum, Monte Carlo,
walk-forward). Your 93% capture is currently attackable as "of course it reverts."
- **Action:** add a **random-entry baseline** to `history/run.ts`: same number of entries at random
  timestamps, same exit rule. If real convergence-capture/PnL beats the random baseline by a wide,
  stable margin out-of-sample → that's your defensible alpha statement. If it doesn't → you must
  know now. Add a **shuffle test** and report the margin. This is the experiment that converts
  "tautology" into "edge, p-quantified."

### 4.5 Lookahead Sentinel + network-disabled tests — cheap, devastating credibility
From Vibe-Trading's quality gates: a **Lookahead Sentinel** corrupts all data past a temporal probe
and asserts the factor output is unchanged to 1e-9 (proves no future leakage); **pytest-socket**
runs the suite network-disabled (deterministic). NightDesk's tests are already offline/deterministic
(mock council, replay).
- **Action:** add (a) a **lookahead-sentinel unit test** over `fairvalue.ts`/`study.ts` series
  builders, and (b) a CI badge "tests run network-disabled, deterministic." This is exactly the kind
  of engineering rigor Filippo (Dune) rewards, and it's ~1 day of work.

### 4.6 Sizing over win-rate — fix the vanity metric AND the sizing
Research: position sizing on conviction beats high win-rate static sizing; **win-rate is an overrated
headline.** This independently confirms killing the "100% win rate" brag.
- **Action:** size by council confidence (already produced as `card.confidence` / proposal), and
  report **risk-adjusted** numbers (Sharpe/Sortino-lite, avg R, max drawdown) instead of win-rate as
  the hero metric. Your `scorecard.ts` should surface convergence-capture vs random baseline + PnL net
  of fees + drawdown, NOT win-rate.

### 4.7 The one paradigm gap: persistent memory (optional, real upside)
Research lists four foundational agentic concepts: autonomy+deterministic oversight ✅, role
specialization ✅ (bull/bear/supervisor), **persistent memory ❌**, dynamic DAG orchestration ❌.
RUNECLAW has a memory/learning system; NightDesk treats each night as stateless.
- **Action (P2):** add a lightweight per-ticker memory of past convergence outcomes (a JSON store the
  council sees: "last 5 RNVDA stretches: 4 converged in <6h, avg narrow 0.5pp"). Cheap, and it
  upgrades the story from "stateless rule" to "system that accumulates context" — matching the
  research's definition of agentic. Don't over-build it.

### 4.8 Latency & cost framing — a quiet advantage, state it
Research: multi-agent loops take minutes → slippage; frontier swarms cost ~$100/day. NightDesk trades
a **slow, overnight convergence signal** where multi-minute LLM latency is irrelevant, and runs the
offline sim on a **deterministic council (zero token cost)**. Say this: "we deliberately chose a
slow-horizon signal so reasoning latency never costs us a fill, and our sim costs $0 to reproduce."

### 4.9 Position vs tauricresearch/tradingagents (86k★) — the reference the judges know
TradingAgents = the canonical multi-agent firm (7 personas, bull/bear debate, risk team, structured
schema reports). NightDesk's council is a focused descendant. **Frame it:** "TradingAgents proved the
multi-agent debate pattern on generic equities; NightDesk specializes it for the one market that only
exists on Bitget — tokenized US stocks off-hours — with a deterministic basis edge and a real fill
sandbox." Borrow their credibility, don't compete on breadth. (Minor: consider structured-schema
bull/bear outputs, as they do, to reduce info decay — only if time permits.)

---

## 5. The honest evidence package we publish (the deliverable judges verify)

1. **Live PegWatch dashboard** — continuous fair-value/depeg board, recording 24/7 (the public good).
2. **Honest backtest report** — convergence-capture **vs random baseline**, out-of-sample split,
   cost sweep, perp-leg (tradeable) PnL shown openly, net of fees, with drawdown. Reproducible:
   `npm run backtest`.
3. **A graded autonomous night** — full `perception → council → gates → BitSim → grade` ledger,
   replayable, **Ed25519-signed**, with the **"0 human interventions" counter** as the hero metric.
4. **BitSim standalone repo + MCP one-liner** — the infrastructure claim, verifiable in 2 minutes.
5. **Look-ahead / contamination statement + lookahead-sentinel test + network-disabled CI badge.**
6. **(Optional) one real Bitget perp micro-trade** with a real order ID.
7. **Playbook package(s)** validated on-platform (`playbook/raapl-convergence`, `btc-convergence`).

Every claim above is something a judge can re-run or re-read. That is what "can't lose" means.

---

## 6. Positioning / the one-liner

> **NightDesk is the fair-value transparency + open execution-infrastructure layer for Bitget
> tokenized US stocks — the only fully autonomous, deterministically-gated, honestly-graded
> convergence desk in the hackathon. The LLM never predicts a price it could have memorized; it only
> judges a live basis it has never seen. Complete loop, no human in the middle — and every number is
> reproducible.**

Judge-by-judge: PegWatch data rigor → **Filippo (Dune)**; autonomous loop + MCP infra → **Henry
(Kite)**; Compliance-Gatekeeper transparency + kill-switch → **Vlad (EVEDEX)**; rToken trust/adoption
→ **Gracy (Bitget)**; deterministic Qwen council → **Qwen sponsor**. No rival shape covers the panel.

---

## 7. Anti-patterns — what will make us LOSE (do not do these)

- **Don't brag about win-rate or any >90% number.** It's the single biggest credibility killer and
  the research explicitly deprioritizes win-rate. Lead with honesty + risk-adjusted + reproducibility.
- **Don't claim profitability.** Claim *measurement, risk, infrastructure, autonomy, honesty.*
- **Don't build the kitchen sink.** Every "(NEW)" feature you add to compete with RUNECLAW's surface
  area makes you look more AI-generated and less trustworthy. Cut, don't add.
- **Don't let the LLM do math/sizing/stops.** Keep it qualitative-only (you already do — keep it).
- **Don't say "fair value" if you keep the perp anchor** — say "basis." Match claims to data exactly.
- **Don't frame BitSim/PegWatch as "fixing Bitget."** Frame as "independent transparency layer that
  builds trust in rTokens" and "ready to plug into official execution the moment it ships."

---

## 8. Prioritized build sequence

**P0 — credibility (existential, do first):**
- [ ] Fix `basisBacktest()` survivorship (time-stop / mark-to-end; count all losers).
- [ ] Add random-entry baseline + shuffle test to `history/run.ts`; report the margin.
- [ ] Replace win-rate hero metric with convergence-vs-random + net PnL + drawdown in `scorecard.ts`.
- [ ] Re-run `npm run backtest`; put the *honest* numbers on the dashboard.
- [ ] Add the look-ahead/contamination statement (README + dashboard).

**P1 — moat & narrative:**
- [ ] Ship BitSim as standalone MIT repo + MCP one-liner.
- [ ] Ed25519-sign ledger cycles; label architecture "Compliance Gatekeeper Pattern" in README.
- [ ] Add lookahead-sentinel unit test + network-disabled CI badge.
- [ ] Decide fair-value anchor: real equity quote, or rename to "basis monitor."
- [ ] Wire one real perception source (Skill Hub news/macro) OR document council = veto layer.
- [ ] Run PegWatch recorder continuously through judging; publish the dataset.

**P2 — upside (only if P0/P1 done):**
- [ ] Conviction-based position sizing.
- [ ] Lightweight per-ticker convergence memory (the persistent-memory paradigm).
- [ ] One real Bitget perp micro-trade with order ID.
- [ ] Structured-schema bull/bear council outputs (TradingAgents-style).

---

## 9. The honest probability (so we stay grounded)

- Track 3 podium (2nd/3rd): **likely** — best stock entry by far, competition uses demo data.
- All-tracks #1 framed as a *trading bot*: **low (~10–15%)** — the numbers won't hold.
- All-tracks #1 framed as *transparency/infra + honest metrics + manifesto*, with P0+P1 done:
  **meaningfully higher (~30–40%)** in this weak field.

The path to #1 is not more strategy or more features. It is **deleting every number that can't
survive scrutiny and standing on rigor, transparency, autonomy, and a shipped infra layer.**
That is a fight this field cannot win and NightDesk can.
