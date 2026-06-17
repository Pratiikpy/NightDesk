# ROADMAP.md — building the best Bitget tokenized-stock agentic desk

**Goal:** the best agentic trading system for Bitget tokenized US stocks. **Hard constraint: only
what runs on Bitget data/tools** (+ a free equity-price reference). **Long-horizon build**, but we
still **submit the honest current version on Jun 25** as a checkpoint (free shot at the prize).

Each phase lists: goal · concrete tasks · the studied pattern it borrows · Bitget tie · deliverable.
Principle throughout: **LLM does qualitative judgment only; deterministic code does all math, sizing,
fills, grading. Every number reproducible and control-tested. No profit claims — measurement, risk,
infrastructure, autonomy, honesty.**

---

## Phase 0 — Honest foundation ✅ DONE
- Survivorship-free basis backtest (time-stop + mark-to-end; losers counted).
- Random-entry baseline + shuffle control; edge-over-random reporting.
- Real numbers in: capture% is a distributional artifact (we proved it); gap-fading beats random by
  ~16pp; tradeable perp leg is **negative intraday, positive overnight (+8.9%)**.
- 57 tests pass; reproducible via `npm run backtest`.

---

## Phase 1 — Real data foundation (the credibility fix)
**Goal:** make "fair value" actually the stock price, and expose per-token transparency.
- **Real equity-price anchor** — pull free, no-key delayed US equity prices (Stooq). Off-hours =
  last NYSE close (real, static); RTH = live-ish. New `src/anchor/` module.
  - Premium re-defined: **rToken vs real equity** = the true depeg; keep **rToken↔perp** as a
    separate *basis* signal. Fair value stops being "the perp" (our data showed the perp ≈ naïve
    persistence). This is the single biggest credibility upgrade.
- **Per-token rights/risk flags** — dividends due, corporate actions (split/earnings), tracking
  error vs underlier, sValue multiplier status. Answers the real r/Tokenized questions.
- **Recorder 24/7** — already running; formalize persistence + uptime tracking.
- **(opt) CCXT websocket fallback** — lower-latency, rate-limit-resilient data.
- *Borrows:* TradingAgents `market_data_validator`; CCXT Bitget pro. *Bitget:* spot/perp/candles +
  free equity ref. *Deliverable:* real fair value + transparency flags + continuous dataset.

## Phase 2 — Smarter agent (memory + real signals)
**Goal:** council debates real multi-signal inputs and remembers.
- **Layered convergence memory** — per-ticker store keyed by `{regime, premium bucket}` with
  importance + recency-decay + compound retrieval; feed the council a prior ("last N similar
  stretches: x converged, avg narrow, ~Xh"). Built from our own recorder/ledger.
- **Real signals into EventCards + council context:** basket **co-depeg dispersion** (many tokens
  off together = liquidity event, reverts; one alone = idiosyncratic), **funding rate**, **half-life
  / velocity** selectivity. **Each tested against the random baseline — kept only if it helps OOS.**
- **Council upgrade:** add **3-way risk debate** (aggressive/conservative/neutral) + **research
  manager** (synthesize bull/bear) + **portfolio manager** (final size) + **reflection** step that
  writes a lesson to memory after grading. LLM stays qualitative-only.
- *Borrows:* FinMem `memorydb`; TradingAgents roles + reflection. *Bitget:* funding, books, our data.
  *Deliverable:* a stateful, multi-signal, self-reflecting council.

## Phase 3 — Real execution feel (maker, not just taker)
**Goal:** honestly simulate capturing the spread, plus the spot-perp basis.
- **BitSim maker model** — Avellaneda-Stoikov / inventory-skew passive quoting; honestly model fill
  probability + adverse selection (no fake-optimistic fills). Lets us test "post on both sides of the
  depeg" vs taking.
- **Spot-perp basis execution** — clean two-leg logic (long rToken / short perp and inverse).
- **(opt) ONE real Bitget perp micro-trade** — needs trade-enabled key + funds + your go-ahead;
  produces a real order-ID proof.
- *Borrows:* Hummingbot `avellaneda_market_making` + `spot_perpetual_arbitrage` + Bitget connectors.
  *Bitget:* perp/spot. *Deliverable:* maker sim + basis sim (+ optional real trade).

## Phase 4 — Public / infrastructure layer
**Goal:** become a thing others can use; make the audit institutional.
- **BitSim as standalone MIT repo + MCP server** (`npx`) — the "foundational infrastructure" claim.
- **Ed25519-signed ledger cycles** + label the architecture the **Compliance Gatekeeper Pattern**.
- **Live public dashboard + alert bot** (Telegram/X) — functional deploy; agentic-dashboard content
  (live loop, gates panel, 0-human hero, health strip, open positions, audit log, session banner).
  *(UI/visual handled separately.)*
- *Borrows:* TradingAgents persistent log; institutional Compliance Gatekeeper Pattern. *Bitget:*
  publishes Bitget tokenized-stock data as a public good. *Deliverable:* adoptable infra + signed
  audit + live faces.

## Phase 5 — Proof (make every claim bulletproof)
**Goal:** survive any quant judge.
- **Look-ahead sentinel test** (corrupt future rows, assert factor output unchanged) + **network-
  disabled deterministic CI**.
- **Walk-forward** + standard **risk-adjusted analyzers** (Sharpe/Sortino/maxDD/turnover) on the
  growing dataset.
- **Adversarial sim** — a hostile agent that hunts our stops; if we survive, the edge is real.
- **Real recorded multi-night graded track record** + the **look-ahead/contamination statement**.
- *Borrows:* Backtrader analyzers + walk-forward; TradingAgents `test_news_lookahead`. *Deliverable:*
  a bulletproof, reproducible evidence pack.

---

## Sequencing & what's doable now
- **Now (no blockers):** Ed25519 signed ledger (Phase 4 item, zero deps) · real equity anchor
  (Phase 1, Stooq, no key) · basket/funding/half-life signals + memory (Phase 1/2) · look-ahead
  sentinel test (Phase 5).
- **Needs you:** BitSim standalone repo → your GitHub to publish · real perp micro-trade → trade key
  + funds + go-ahead · dashboard deploy → a host.
- **Hackathon checkpoint (Jun 25):** submit with Phase 0 (done) + as much of Phase 1 + the signed
  ledger + look-ahead statement as lands — the honest, controlled package.

## Active build order (starting immediately)
1. Ed25519-signed ledger + "Compliance Gatekeeper Pattern" framing. *(no blockers)*
2. Real equity-price anchor (Stooq) → redefine fair value. *(no blockers)*
3. Basket co-depeg + funding + half-life signals, tested vs random baseline.
4. Layered convergence memory + reflection.
5. Look-ahead sentinel + network-disabled CI note.
