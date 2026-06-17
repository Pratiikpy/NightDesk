# NightDesk — Product Requirements Document (PRD)

**Product:** NightDesk — The Fair-Value Layer + Convergence Agent for Tokenized US Stocks
**Three-layer build:** ① BitSim (open-source paper-trading sandbox) ② PegWatch (fair-value/depeg engine + terminal) ③ NightDesk agent (the complete loop)
**Target:** Bitget AI Base Camp Hackathon S1 — submit Track 3 🟧, compete for all-tracks #1
**Status:** v3.3 — Jun 14, 2026. Bulletproof pass: every load-bearing assumption verified against the live API (`verification-log.md`). Changes vs v3.2: weekend trading CONFIRMED viable (perp-leg only); rToken order books are INTERMITTENT → BitSim is quote-first; Agent-Hub execution CONFIRMED read-only (wedge holds); fair value re-anchored on real equity price (Playbook) with perp as live proxy; Ondo sValue total-return adjustment added; fee-aware gate added (15 gates); issuer = Reality named; data-quality traps logged.
**Submission window:** Jun 15 – Jun 25, 24:00 (UTC+8) · Judging Jun 25–29 (system stays live)

---

## 0. ⚠️ AUDIT PIVOTS — READ FIRST

An adversarial audit (Jun 10) inverted the hero; a bulletproof live-API pass (Jun 14, `verification-log.md`) corrected the mechanics. **The chassis is unchanged.**

| v1 (killed) | current (v3.3) | Why |
|---|---|---|
| Agent's edge = directional after-hours news/earnings bets | Agent's edge = **convergence trades**: premium/discount mean-reversion + spot↔perp basis vs PegWatch fair value | 1 confirmed in-window earnings event (Micron Jun 24, MUUSDT perp — no rMU) + FOMC → directional = ~2 coin flips; premiums fluctuate constantly → dozens of graded convergence events/night (high-n). A losing directional P&L = demo suicide; convergence looks rigorous even when small. |
| PegWatch = internal risk layer | **PegWatch = the product**; the agent is its enforcement arm | XEdge (Kraken xStocks, Apr 2026) already shipped a multi-agent LLM council trading tokenized-stock perps → that's commodity. Nobody has built the fair-value/depeg layer. |
| Headline scorecard = directional hit rate | Headline = **peg-tracking error, convergence capture rate, basis sim PnL** (+ FOMC & Micron showcases) | Structural metrics can't produce a humiliating red number. |
| Weekend trading dropped (sources conflicted) | **Weekend mode RESTORED — perp-leg only** (v3.3, verified Sun Jun 14: perps trade 24/7 with real volume; rToken spot is quote-only, ~zero weekend volume) | Weekend is a real, schedulable showcase most analyses ignore. We trade the liquid perp leg and measure dislocations on all venues. |
| Fair value = ground truth | Fair value = **real underlying equity price** (Playbook sandbox `equity.price.*`) as anchor where available, **Bitget perp price as the live off-hours proxy**, with uncertainty bands + Bitget's ±3% closure clamp noted; **Ondo legs sValue-adjusted** | No consolidated tape at 3am; the perp is itself a derivative so it's a proxy, not truth. Real equity price (for grading/backtest) + perp (for live) is the honest split. |
| BitSim records L2 + depth-aware fills for all | **Quote-first for rTokens** (ticker bid/ask + spread model; L2 books are intermittent — 9/19 live at any moment); depth-aware L2 only for perps/Ondo/crypto | Verified Jun 14: rToken L2 books appear/vanish by name and time; ticker quote is the only always-present signal. |

## 0.5 — Trojan Horse rationale (the all-tracks #1 play)

**Verified (V4, `verification-log.md`):** Bitget's official MCP server is **read-only** — its compiled source contains only read-only references and zero order-placement tools; the FAQ confirms "order execution is not fully implemented; positions sync to a simulated account." **Every team's autonomous agent has no real-execution hands.** v3.3 turns our fill-simulator into **Layer 1 of the product** and structures the build as a Trojan Horse for the all-tracks #1 (full rationale + day-by-day plan: `win-strategy.md`; judge-taste profile: `judges-intel.md`):

| Layer | What | Why it wins |
|---|---|---|
| **① BitSim** | Open-source paper-trading sandbox: **quote-first fill engine for rTokens** (ticker bid/ask + spread/slippage), depth-aware L2 fills for perps/Ondo/crypto, fee + funding + latency model, NYSE session library, MCP adapter | Fills the read-only-execution hole every team hits; Track 2's listed example verbatim; claim = "we open-sourced the execution layer the platform was missing" — verifiable from the repo alone. Passive distribution (announce twice, no support duty). |
| **② PegWatch** | Fair-value/depeg engine (real-equity-anchored, sValue-adjusted, three-venue triangulation) + public terminal + depeg alert bot (X/Telegram, #BitgetHackathon) | The only genuinely novel component; engagement engine; every recorded night compounds evidence. |
| **③ NightDesk** | Autonomous convergence agent: Skill Hub perception → bull/bear/risk council on **qwen3.6-plus** → BitSim execution → 15 gates → auto-graded vs NYSE open; public **"0 human interventions in N nights"** counter | The manifesto ("complete loop, no human in the middle") made visible and verifiable. |

Evidence (rules require one form; we guarantee two + bonus): replayable sim logs (hundreds) + logged API-call volume — both fully in our control — plus any passive user count (terminal/bot/GitHub) as bonus.

## 1. One-Sentence Definition

> Tokenized US stocks trade around the clock, but price discovery only exists while Wall Street is open. NightDesk is the fair-value layer for the rest — PegWatch computes what every Bitget rToken *should* be worth (anchored on the real underlying price, sValue-adjusted across rToken/Ondo/perp) and flags every depeg; an autonomous agent trades the convergence through our open-source BitSim sandbox; and every call is self-graded against the official NYSE open — a complete loop, no human in the middle, live through FOMC, Micron earnings (Jun 24), weekends, and the entire judging window.

---

## 2. Problem Statement

US stocks now trade ~24/7 as tokens (Bitget Stocks 2.0 **rTokens**, issued by **Reality** — Bitget's RWA arm — + 24/7 stock perpetuals), but **real price discovery exists only during the NYSE session**. The rest of the time:

1. Prices are set by thin crypto-side liquidity and broker-quote RFQ; cross-venue dislocations are real and persistent (verified live: AAPL Ondo +0.7% vs rToken/perp on a single snapshot). Tokenized-equity depegs are a documented category failure — e.g. a tokenized AMZN traded at a **~100x premium (Jul 2025)** that went un-arbitraged because redemption friction exceeded the arb window.
2. The arbitrage that *should* close these is **institution-only** (Ondo primary mint/redeem requires KYC; US persons barred) → retail cannot correct mispricings → dislocations widen and persist.
3. Market-moving events land in this window (earnings ~4:05pm ET, FOMC digestion, Asia/Europe sessions, weekend geopolitics), and weekends have **no primary redemption anchor at all** while perps keep trading.

**No product measures or trades this.** TradingAgents / ai-hedge-fund are agent frameworks with no real execution and no off-hours concept. RWA.xyz has no fair-value model. Nobody publishes a fair-value/depeg layer for tokenized stocks (competitive scan: not contradicted).

## 3. Why Bitget (and only Bitget) — all live-verified

| Requirement | Bitget capability (verified) |
|---|---|
| 24/7 US stock exposure (long) | **26 rTokens** (issued by Reality), USDT-settled — `config/universe.json`. Spot is quote-driven (RFQ); L2 books intermittent. |
| Shorting/hedging + weekend leg | **21 stock perps**, up to 100x (we cap 3x); **trade 24/7 with real weekend volume** (verified Sun Jun 14). **19 have a matching rToken = basis-pair universe.** |
| Second token family (triangulation) | **10 Ondo tokens** (AAPLON…), total-return instruments → sValue-adjusted. 9 tickers have rToken+Ondo+perp all live. |
| Agent-native perception | **Skill Hub installed** (`macro-analyst`, `news-briefing`, `sentiment-analyst`, `technical-analysis`, `market-intel`) + market-data MCP — no key needed. |
| Execution | Agent Hub MCP = **read-only (verified)**; we execute via BitSim. |
| Strategy validation + real data | **Playbook/GetAgent sandbox** (key in `.env`): backtests rToken symbols natively AND exposes **real equity prices + dividend/split/earnings calendars** (`equity.*`). Deterministic strategies only (LLM not backtestable). |

Schwab/IBKR have no 24/7 market. Kraken/Bybit have tokens but no agent toolkit + no second token family on the same venue. The product is physically impossible anywhere else.

### 3.5 Verified Universe + data traps (authoritative: `config/universe.json`, `verification-log.md`)

| Bucket | Count | Contents |
|---|---|---|
| **Basis pairs** (rToken + matching perp) | **19** | AAPL, TSLA, NVDA, MSFT, GOOGL, AMZN, META, SPY, QQQ, SQQQ, TQQQ, PLTR, CRCL, HOOD, MSTR, ORCL, NFLX, BABA, GME |
| Spot-only rTokens (flat-by-open must CLOSE, not hedge) | 7 | AVGO, INTC, AMD, UBER, LLY, ABNB, UNH |
| Perp-only (no rToken) | 2 | COIN, MU (Micron Jun 24 showcase = MUUSDT perp) |
| **Ondo tokens** (total-return, sValue-adjusted) | 10 | AAPLON, TSLAON, NVDAON, MSFTON, GOOGLON, AMZNON, METAON, SPYON, QQQON, AMDON |

**Data traps (must encode):**
- rToken ticker `usdtVolume` is **garbage** (showed $15.4B; candle vol=0). Use candle volume / trades endpoint, never ticker usdtVolume.
- rToken **L2 books are intermittent** (9/19 live at a given moment); **ticker bid/ask is the always-present signal**.
- Ondo prices are **total-return** (price = underlying × sValue); subtract dividend accrual before computing dislocation, or splits/dividends read as false depegs.
- rToken spot weekend volume ≈ 0; **weekend = perp leg only**.

## 4. Goals & Non-Goals

### Goals
- G1. Complete autonomous loop (**perception → decision → execution → risk**) running unattended every night/weekend of judging.
- G2. **Self-verifying evidence**: every overnight position auto-graded vs the next official US open; cumulative scorecard published live.
- G3. **PegWatch public dashboard** + depeg alert bot.
- G4. Use ≥4 Bitget modules — verified available: **Agent Hub market-data MCP, Skill Hub (≥3 perception skills), Playbook/GetAgent (backtest + equity data), live Bitget data APIs**. (NOT "Bitget paper trading" — that's BitSim, ours.)
- G5. Track-3 fit verbatim: real tokenized-stock problem ✅, verifiable sim/backtest records ✅, uses Bitget US-stock data/tools ✅.

### Non-Goals
- ✗ Real-capital trading. ✗ HFT/sub-second. ✗ Intraday RTH trading (we stand down 9:30–16:00 ET). ✗ NL strategy-builder UI (that's Playbook). ✗ Token launch / custom oracle network.

## 5. Users & Personas

| Persona | Need | Surface |
|---|---|---|
| Crypto-native rToken trader | Don't get wrecked by ghost prices | PegWatch dashboard + alerts |
| Event trader (earnings/macro) | Be positioned minutes after a release | NightDesk signal feed |
| DeFi protocol / venue (post-hack) | Trustworthy off-hours fair value for rToken collateral | PegWatch API |
| Hackathon judge | Real, runnable, verifiable, Bitget-native | Live dashboard + nightly scorecard + replay log |

## 6. Operating Modes — session-aware state machine (NYSE phases, ET)

| Phase | Mode | Behavior |
|---|---|---|
| 09:30–16:00 Mon–Fri | **STAND-DOWN** | No new positions. Grade overnight book vs 09:30 open. Update scorecard. Passive PegWatch. |
| 16:00–20:00 | **EARNINGS SPRINT** | Earnings calendar armed; news-briefing high-freq; event pipeline hot. |
| 20:00–04:00 | **OVERNIGHT** | Asia/Europe signals, macro digestion, sentiment drift, basis arb. |
| 04:00–09:30 | **PRE-OPEN WIND-DOWN** | Reduce risk; by 09:25 ET every position **flat or fully hedged** (hard gate). Publish "Open Forecast". |
| Fri 16:00 – Mon 09:30 | **WEEKEND (perp-leg only, v3.3 — verified viable)** | Perps trade 24/7 with real volume → tradeable. rToken spot is quote-only (~0 volume) → measure, don't trade spot. PegWatch computes fair values + depeg alerts all weekend (Ondo has no redemption anchor → predictable dislocations). Publish "Monday Open Forecast", graded Mon 09:30. |
| US holidays | WEEKEND rules | |

---

## 7. System Architecture

```
                ┌────────────────────────────────────────────────┐
                │                ORCHESTRATOR                     │
                │   session state machine + event bus + scheduler │
                └──┬──────────────┬──────────────┬───────────────┘
                   │              │              │
        ┌──────────▼───┐  ┌───────▼────────┐  ┌──▼─────────────┐
        │ PERCEPTION   │  │ DECISION       │  │ EXECUTION      │
        │ Skill Hub:   │  │ Bull agent     │  │  BitSim        │
        │ news/macro/  │  │ Bear agent     │  │ quote-fill     │
        │ sentiment/   │  │ Risk Supervisor│  │  rTokens;      │
        │ technicals/  │  │ (veto)         │  │ depth-fill     │
        │ market-intel │  └───────┬────────┘  │  perps/Ondo    │
        │ + earnings   │          │           └──┬─────────────┘
        └──────┬───────┘  ┌───────▼──────────────▼─────────────┐
   real equity │          │            RISK ENGINE              │
   price +div/ │          │  15 Hard Gates (pre-trade + live)   │
   split (PB)  │          │  incl. depeg, fee-edge, flat-by-open│
        ┌──────▼───────┐  └───────────────┬─────────────────────┘
        │  PEGWATCH    │──────────────────┤
        │ real-anchor  │  ┌───────────────▼─────────────────────┐
        │ +sValue +tri │  │   LEDGER & SCORECARD                │
        └──────┬───────┘  │  replayable audit + auto-grade vs   │
        ┌──────▼───────┐  │  official NYSE open                 │
        │ PUBLIC DASH  │◀─└─────────────────────────────────────┘
        │ + alert bot  │
        └──────────────┘
```

**Stack:** TypeScript/Node end-to-end (recorder, BitSim, MCP adapter, dashboard); Postgres (ledger); Redis (event bus/state); Next.js dashboard; LLM = pluggable provider, qwen3.6-plus via hackathon proxy (`.env`). Universe from `config/universe.json` (no hardcoded symbols). Real equity data + calendars from the Playbook sandbox (`equity.*`).

---

## 8. Functional Requirements

### 8.1 Orchestrator & Session Engine (`core`)
- **FR-1.1** NYSE market calendar (sessions, half-days, holidays, ET↔UTC). Bitget has no market-hours tool — we build it; publish as a reusable mini-lib.
- **FR-1.2** Emit phase-change events (`RTH_CLOSE`, `EARNINGS_WINDOW`, `PRE_OPEN`, `WEEKEND_START`…) that switch mode.
- **FR-1.3** Heartbeat + watchdog: module stall >N min → flatten-or-hedge + alert.
- **FR-1.4** All state persisted; restartable mid-night without losing positions/context.

### 8.2 Perception Layer (`senses`)
- **FR-2.1** Poll Skill Hub `news-briefing` (high-freq during EARNINGS SPRINT); dedupe; map headlines → universe tickers.
- **FR-2.2** Poll `macro-analyst` (FOMC/CPI/jobs), `sentiment-analyst` (regime), `technical-analysis` (levels), `market-intel`.
- **FR-2.3** Earnings calendar: live source for runtime; **Playbook `equity.calendar.earnings`** for backtest (EPS actual/consensus/surprise + reporting_time). Arm per-ticker watchers on report days.
- **FR-2.4** Normalize every stimulus into an **EventCard**: `{event_id, type, tickers[], direction_hint, magnitude_est, confidence, half_life, sources[], ts}`.
- **FR-2.5** Numeric grounding: any LLM-quoted number re-verified against raw API/source before the card is admitted (anti-hallucination).

### 8.3 PegWatch — Fair-Value & Depeg Engine (`pegwatch`)
- **FR-3.1** For every rToken, compute **reference fair value**: **anchor = real underlying equity price** (Playbook `equity.price.*`, for grading/backtest); **live off-hours proxy = Bitget perp price** (single names) or index-perp (rSPY/rQQQ); adjust by sentiment drift; output `{fv, premium_pct, confidence, liquidity_score}` ≤30s. No external CME feed.
- **FR-3.2** Liquidity score: **quote-first** — spread + quoted size from the ticker (always present); add L2 depth when the book is live. Never assume depth exists for rTokens.
- **FR-3.3** Depeg classification: NORMAL (<0.5%), STRETCHED (0.5–2%), DISLOCATED (>2%) — per-asset configurable, **net of fees** (a 0.4% premium isn't tradeable after 0.32% round-trip).
- **FR-3.4** Emit basis-arb EventCards when |premium| crosses STRETCHED with adequate liquidity AND edge > round-trip cost.
- **FR-3.5** Serve via internal API → Risk Engine + dashboard.
- **FR-3.6** **sValue-adjusted three-price triangulation**: for the 9 tickers with rToken+Ondo+perp, first **normalize the Ondo leg by its sValue total-return multiplier** (from the dividend/split calendar), then compute pairwise premia (rToken↔perp, Ondo↔perp, rToken↔Ondo). Triangular disagreement beyond threshold = high-confidence dislocation. Unadjusted comparison would read dividend drift / splits as false depegs — the single most demo-able piece of domain expertise vs naive competitors.

### 8.4 Decision Layer (`council`)
- **FR-4.1** **Event-scoped debate**: an admitted EventCard convenes Bull, Bear (2 rounds max), then **Risk Supervisor** with absolute veto.
- **FR-4.2** Output **TradeProposal** `{ticker, instrument(spot|perp), side, size_pct, entry_band, stop, take_profit, thesis, expected_horizon, event_ref}` or `NO_TRADE` + reasoning.
- **FR-4.3** Position sizing: conviction-scaled, hard-capped (Kelly-fraction ceiling); never exceeds Risk Engine caps.
- **FR-4.4** Full debate transcript persisted (replayable).
- **FR-4.5** LLM provider abstraction; per-decision token/cost logging. Runs on qwen3.6-plus.

### 8.5 Execution Layer (`hands`) — executes through BitSim
- **FR-5.0** All sim orders execute through **BitSim** (§8.10). If Bitget ships real stock-product execution during the event, BitSim adds a one-line passthrough adapter ("first to integrate").
- **FR-5.1** Account state mirrored on a dedicated Bitget **sub-account**; market data pulled live + logged as API-call-volume evidence.
- **FR-5.2** Longs: spot rTokens (quote-fill). Shorts/hedges/**weekend**: stock perps (≤3x effective leverage).
- **FR-5.3** Limit-order-first inside entry band; **quote-aware** slippage estimate for rTokens, depth-aware for perps/Ondo; fills/partials/rejections logged.
- **FR-5.4** Hedge primitive: neutralize a spot position via the matching perp. Only the 19 basis-pair tickers are hedgeable; the 7 spot-only rTokens **force CLOSE** at flat-by-open (no hedge path) — enforced from `config/universe.json`.

### 8.6 Risk Engine — 15 Hard Gates (`gates`)
Pre-trade (all must pass):

| # | Gate | Rule (default) |
|---|---|---|
| 1 | Max position | ≤10% sim equity per ticker |
| 2 | Max gross exposure | ≤50% sim equity |
| 3 | Depeg gate | No entry if PegWatch = DISLOCATED (unless the trade *is* the risk-sized basis-arb) |
| 4 | Liquidity gate | Quote-based: spread + quoted size OK; est. slippage ≤0.3%; (L2 depth check when book present) |
| 5 | Event-confidence gate | EventCard confidence ≥ threshold; numeric grounding passed |
| 6 | Leverage gate | Effective leverage ≤3x |
| 7 | Correlation gate | No >2 concurrent positions with >0.7 correlation |
| **13** | **Fee-edge gate (v3.3)** | Expected edge > round-trip cost (≈0.32% spot+perp) + funding; else NO_TRADE |

Live (continuous): | 8 Per-position stop-loss (engine-side) | 9 Max daily drawdown −3% → flatten+lock | 10 **Flat-or-hedged by open** 09:25 ET, no exceptions | 11 Stale-data gate | 12 Kill switch (manual + watchdog) |
- **FR-6.1** Every gate evaluation logged per proposal — gates are countable/demonstrable in the demo.

### 8.7 Ledger, Scorecard & Audit (`ledger`)
- **FR-7.1** Append-only ledger: EventCard → debate → proposal → gates → orders → fills → exit → outcome, linked by `event_id`.
- **FR-7.2** **Auto-grading** at 09:30 ET vs official open (real equity price from Playbook): direction hit/miss, sim PnL, vs buy-and-hold.
- **FR-7.3** Cumulative metrics: hit rate, sim PnL, max DD, Sharpe, per-event-type breakdown, gate-block counts, LLM cost/trade.
- **FR-7.4** One-click **replay** of any night (judge feature).

### 8.8 Public Surface (`face`)
- **FR-8.1** **PegWatch dashboard**: live premium/discount table (all rTokens, sValue-adjusted), depeg states, scorecard, open sim positions + theses, nightly recap.
- **FR-8.2** **Alert bot** (Telegram + X): depeg alerts + nightly Open Forecast/recap, #BitgetHackathon + @Bitget_AI.
- **FR-8.3** Read-only; no accounts needed for demo.

### 8.9 Playbook & Backtest Validation (`proof`) — deterministic only
- **FR-9.1** Express the **convergence/basis mean-reversion** rule-strategy as a Bitget **Playbook** (deterministic — LLM strategies can't be backtested there); backtest on rToken+perp data (natively supported); publish; capture metric tables (PnL, max DD, Sharpe, win rate). *(Earnings-momentum dropped — directional, off-thesis.)*
- **FR-9.2** Use the sandbox's **real equity prices + dividend/split calendars** as backtest ground truth (this is what makes peg-tracking-error rigorous, and what calibrates the sValue adjustment).
- **FR-9.3** Evidence pack: published Playbook backtest + live BitSim sim record from the judging window. **Role split:** Playbook = deterministic, on-Bitget, published artifact; BitSim = the live LLM-loop executor (LLMs can't run in Playbook).

### 8.10 BitSim — Open-Source Paper-Trading Sandbox (`bitsim`, Layer ①)
- **FR-10.1** **Recorder**: snapshot live ticker quotes (always) + L2 books (when present) + trades for the universe; timestamped, compressed, published. For rTokens the **ticker quote stream is primary**; L2 is opportunistic.
- **FR-10.2** **Fill engine**: **quote-driven fills for rTokens** (ticker bid/ask + spread/slippage model); **depth-aware fills for perps/Ondo/crypto** (recorded L2); Bitget fee schedule + funding + configurable latency; deterministic replay.
- **FR-10.3** **Accounts**: virtual balances, positions, margin/leverage for perps, PnL; multiple isolated accounts.
- **FR-10.4** **Interfaces**: TS/Python SDK + REST + **MCP adapter** (one config line — mirrors Agent Hub's MCP pattern).
- **FR-10.5** **Session library**: NYSE calendar as a standalone import.
- **FR-10.6** MIT, 5-min README, examples, published to GitHub + npm by **Jun 15**; passive distribution (one Telegram + one X post, no support duty); stars/adopters = bonus evidence only.
- **FR-10.7** NightDesk runs on BitSim (dogfooding) — every trade doubles as a BitSim integrity demo.

## 9. Key Flows

**Flow A — Earnings Sprint (demo video):** 16:05 ET ticker reports → `news-briefing` headline ~16:06 → EventCard (surprise verified vs raw source) → council (Bull/Bear/Risk) → gates 1–7+13 pass → 16:09 limit buy (sim) filled, stop+TP armed, alert posted → overnight trail → 09:25 flat-by-open → 09:30 graded vs official open → scorecard + recap auto-posted. **Human input: zero.**

**Flow B — Basis Arb:** PegWatch flags rNVDA premium +1.8% STRETCHED (sValue-adjusted, edge > fees) → EventCard(basis) → council sizes short-perp/long-spot pair → converges → both legs closed → graded on convergence PnL.

**Flow C — Weekend (v3.3, verified viable):** Saturday geopolitical headline → sentiment shift → **perp-only** position (perps have weekend volume; rToken spot quote-only) → PegWatch tracks the no-redemption-anchor dislocation across rToken/Ondo/perp → Sunday-night "Monday Open Forecast" → graded Monday 09:30.

## 10. Success Metrics

| Metric | Target |
|---|---|
| Autonomous nights without intervention | ≥8 of 10 |
| **Peg-tracking error** (fair value vs actual open) | Median abs. error < naive "last close" baseline |
| **Convergence capture rate** | >60%, n in the hundreds |
| Basis/convergence sim PnL | Positive; reported with trade count + slippage/funding assumptions |
| Event showcases | FOMC (Jun 16–17, verify) + Micron Jun 24 (MUUSDT perp): premium/basis tracked + ≥1 graded trade each |
| **Weekend showcase (v3.3)** | ≥1 weekend dislocation tracked + perp-leg trade graded Monday open |
| BitSim release | Published (GitHub+npm, MIT, MCP adapter) + 2 announcements; stars/adopters = bonus |
| Evidence | Two guaranteed: replayable sim logs + API-call volume; passive user count = bonus |
| Zero-intervention counter | Public; never reset by manual override during counted nights |
| Gate blocks demonstrated | ≥5 distinct gates fired in logs |
| Bitget modules used | ≥4 (market-data MCP, ≥3 Skill Hub skills, Playbook, live data APIs) |
| Dashboard uptime during judging | >99% |
| Community posts | ≥1/night auto-generated + event posts within hours |

## 11. Milestones (parallelizable; day-by-day in `win-strategy.md` §5)

| Phase | Deliverable |
|---|---|
| **M0 — validation** | ✅ DONE: read-only key + auth; universe (`config/universe.json`); Skill Hub + Playbook installed; weekend/book/execution/fees all live-verified (`verification-log.md`). ⏳ left: Monday RTH spot-liquidity check; ±3% clamp re-cite; MU/FOMC date confirm. |
| **M0.5 — evidence collection** | PegWatch recorder logging quotes + premiums + (when present) L2 from now — every recorded night compounds. |
| **M1** | Session engine + ledger + BitSim quote/depth fill engine |
| **M2** | PegWatch engine (real-anchor + sValue + triangulation) + internal API |
| **M3** | Perception pipeline + EventCards + earnings calendar |
| **M4** | Council + 15 gates wired end-to-end |
| **M5** | First fully autonomous night; auto-grading live |
| **M6** | Dashboard + alert bot public; nightly posting |
| **M7** | Playbook convergence backtest (real equity data) = published evidence |
| **M8** | ≥8 autonomous nights; demo video (Flow A); description <200 words; submit |

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| rToken spot thin / intermittent books | Quote-first fills; liquidity gate sizes to quoted size; lead with the liquid perp leg; **verify RTH depth Monday** |
| Ondo sValue / split → false depeg | sValue normalization via dividend/split calendar before any comparison (FR-3.6) |
| Weekend rToken spot ~0 volume | Weekend = perp-leg only; spot is measure-only |
| LLM hallucination | Numeric grounding, 3-layer debate, engine-side stops, gates are code |
| Few macro events | Earnings near-daily + overnight news + basis arb + weekend = multiple event types |
| LLM cost runaway | Event-scoped debates; cost logged; flash model for perception, strong for council |
| Fee floor makes small premiums unprofitable | Fee-edge gate (#13): edge must exceed ~0.32% + funding |
| "Foundational infra" questioned if low adoption | Claim = shipped open-source layer (repo + MCP one-liner verifiable in 2 min); adoption = bonus |

## 13. Submission Package (Track 3, competing for all-tracks #1)

- **Demo link:** PegWatch terminal (live premiums, sim positions, scorecard, replay, zero-intervention counter) **+ BitSim GitHub repo**.
- **Evidence:** replayable sim logs + API-call volume (guaranteed) + passive user count (bonus).
- **Description (<200 words):** problem (broken off-hours price discovery) → loop (Skill Hub perception → bull/bear/risk council on Qwen → BitSim execution → 15 gates incl. depeg + fee-edge) → evidence (N autonomous nights, hit rate, published Playbook backtest on real equity data) → modules used. **Framing rules (judges-intel.md): PegWatch = "independent transparency layer that builds trust in Bitget's rTokens"; BitSim = "ready to plug into official execution the moment it ships."**
- **Demo video (≤3 min):** Flow A, one real evening, screen-recorded.
- **Community posts:** bot recaps + dev diary, #BitgetHackathon + @Bitget_AI.

## 14. Open Questions

1. ✅ Universe (26 rTokens / 19 basis pairs / 10 Ondo) — `config/universe.json`.
2. ✅ Weekend trading — perps 24/7 with volume; rToken spot quote-only (`verification-log.md` V1).
3. ✅ rToken order books — intermittent; quote-first (V2).
4. ✅ Agent Hub execution — read-only confirmed (V4).
5. ✅ Playbook stock support — yes, rToken-native + real equity data (`getagent-capabilities.md`).
6. ⏳ rToken spot **RTH** liquidity depth — test Monday (sizes the spot leg).
7. ⏳ ±3% mark-price clamp — re-cite from official Bitget docs before showing judges.
8. ⏳ Bitget ON-pair accrual mode (price-embeds-sValue vs balance-rebase) — test across a dividend date.
9. ⏳ MU Jun 24 + FOMC Jun 16–17 — confirm dates directly.
10. ⏳ Skill Hub rate limits — sets perception polling frequency.

## 15. Post-Hackathon Expansion

1. Signals → copy-trading/vault on Bitget (performance fees).
2. **PegWatch API** licensed to DeFi protocols using rTokens as collateral (depeg-liquidation is a funded, real problem).
3. Multi-venue fair value (Kraken xStocks, Ondo, Dinari) → the overnight price-discovery layer for the entire tokenized-equity wave.
4. Institutional overnight execution intelligence (Blue Ocean ATS demand, $1.2B/day).
