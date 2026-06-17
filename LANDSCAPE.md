# LANDSCAPE.md — what we learned from the open-source study

Studied (cloned to `../opensource-study/`, read-only): **TradingAgents** (TauricResearch),
**FinMem** (layered-memory LLM trader), **CCXT** (exchange adapters), **Hummingbot** (execution /
market-making), **Backtrader** (deterministic backtesting).

**Meta-point (honest):** none of these hand you alpha. They hand you *patterns* — architecture,
memory, risk decomposition, execution realism, backtest discipline. ~70% of the "good practice" in
them, NightDesk already does. This doc is: **what to steal · what we already have · what to skip**,
mapped to our phases and the **Bitget-only** constraint.

---

## 1. TradingAgents — the council reference (most relevant)

Real structure (`tradingagents/agents/`): **Analysts** (fundamentals, market/technical, news,
sentiment, social) → **Researchers** (bull, bear) → **Research Manager** (synthesis) → **Trader** →
**Risk mgmt** (aggressive / conservative / neutral debators) → **Portfolio Manager**. Orchestrated
as a **LangGraph DAG** (`graph/`: conditional_logic, propagation, reflection, signal_processing,
checkpointer). Structured-output agents, persistent decision log, multi-provider incl. **Qwen/GLM/
MiniMax**, a `market_data_validator`, and a **`test_news_lookahead.py`**.

**Steal:**
- **3-way risk debate** (aggressive / conservative / neutral) instead of our single supervisor — same
  cost, far richer risk reasoning. Our supervisor keeps the veto.
- **Research Manager + Portfolio Manager roles** — one synthesizes bull/bear, one sets final size.
- **Reflection step** (`graph/reflection.py`) — after grading, the agent writes a lesson → feeds
  memory. This is the bridge to FinMem-style memory.
- **`market_data_validator` + structured outputs everywhere** — formalize our numeric-grounding rule.
- **They ship a news/look-ahead test** — direct validation of our planned look-ahead sentinel.

**Bitget relevance:** venue-agnostic patterns; already supports Qwen (our model). Pure pattern mine.

**Skip:** their fundamentals/social-media analysts (low value for *overnight basis convergence*);
the full LangGraph dependency (we keep our lean TS pipeline, just add conditional branching).

---

## 2. FinMem — the memory pattern (our #1 missing piece)

`puppy/memorydb.py` = a **layered memory**: each memory has an **importance score**, a **recency
score with exponential decay**, and a **compound retrieval score**; importance rises with access;
layered short/mid/long via "jump thresholds"; retrieval via **faiss embeddings**. Three modules:
**Profiling · Memory · Decision-making.**

**Steal (simplified):**
- Per-ticker **convergence memory**: every graded event stored as `{ticker, regime, premium bucket,
  did it converge, half-life, pnl}` with **recency-decay + importance weighting**.
- On a new EventCard, **retrieve the k most similar past events** and hand the council a prior:
  *"last 5 RNVDA overnight stretches of this size: 4/5 converged, avg 0.5pp, ~5h."* Turns the council
  from stateless rubber-stamp into a system that **accumulates context** (the 4th agentic pillar).

**Bitget relevance:** memory is built from *our own Bitget recorder + ledger* data — fully on-platform.

**Skip (at first):** faiss/embeddings. We don't need vector search for ~19 tickers × buckets — a
keyed store with the importance/recency/compound scoring math is enough. Add embeddings only if it
ever earns its keep.

---

## 3. Hummingbot — execution & market-making (Phase 3 goldmine)

Ships **`connector/derivative/bitget_perpetual`** and **`connector/exchange/bitget`** + Bitget spot &
perp **candle feeds**. Strategy library includes **`avellaneda_market_making`**, `pure_market_making`,
`perpetual_market_making`, and **`spot_perpetual_arbitrage`** — i.e., the exact playbook for "make the
spread on the dislocation" and "spot↔perp basis," on Bitget.

**Steal:**
- **Avellaneda-Stoikov / inventory-skew quoting math** → port into BitSim as a *maker* fill model so
  we can honestly simulate posting passive quotes on a depeg (capture spread, not just take).
- **`spot_perpetual_arbitrage` logic** → the clean reference for our rToken↔perp basis trade.
- Their **Bitget connector** = the authoritative reference for live order placement *if/when* we get
  a trade-enabled key (Phase 3 optional real micro-trade).

**Bitget relevance:** direct — native Bitget perp + spot connectors.

**Skip:** running Hummingbot itself (heavy, Python, its own bot). We borrow the *math/patterns* into
BitSim, not the framework.

---

## 4. CCXT — Bitget API reference / fallback

Full Bitget connector: spot, swap/perp, and **pro (websocket)**, plus perpetual-futures examples.

**Steal:** use as the **authoritative endpoint/param reference** and a **fallback data client**
(rate-limit resilience, websocket streaming for lower-latency snapshots than our 30s poll).

**Bitget relevance:** direct. **Skip:** replacing our lean typed client wholesale — our `bitget/
client.ts` is fine; CCXT is the cross-check + optional websocket upgrade.

---

## 5. Backtrader — deterministic backtest discipline

Mature event-driven backtester (analyzers: Sharpe, drawdown, etc.).

**Steal:** the **analyzer pattern** (standard risk-adjusted metrics) and **walk-forward** discipline
for our history engine. We already went survivorship-free + random/shuffle controls; add Sharpe/
Sortino/maxDD/turnover as standard outputs.

**Bitget relevance:** none directly (it's a harness). **Skip:** adopting Backtrader itself — ours is
purpose-built for the premium series; just copy the metrics/rigor.

---

## What NightDesk ALREADY has (don't rebuild)

Multi-agent council (bull/bear/supervisor) · 15 deterministic risk gates · append-only ledger +
scorecard · fee/slippage/funding-aware fill sim (BitSim) · NYSE session machine · numeric grounding ·
survivorship-free backtest **with random + shuffle controls** (better honesty than most of these
repos) · pluggable LLM (Qwen live / deterministic mock) · sValue-adjusted triangulation.

## What to SKIP (the traps)
- Re-platforming onto FinRL/Qlib/TensorTrade (wrong language/scale, not Bitget-focused).
- 8 agents for vanity — only add a role if it gets a **real Bitget input**.
- faiss/embeddings, LangGraph, running Hummingbot/Backtrader as frameworks — borrow patterns, not deps.
- Anything claiming profit; keep the honest "measurement + risk + infra, overnight-positive" story.

## The steal-list, mapped to our phases
| Pattern | From | Phase |
|---|---|---|
| Real per-token data + validation | TradingAgents `market_data_validator` | 1 |
| Layered convergence memory (importance+recency) | FinMem `memorydb` | 2 |
| 3-way risk debate + research/portfolio managers + reflection | TradingAgents | 2 |
| Avellaneda maker quoting + spot-perp-arb | Hummingbot | 3 |
| Websocket/data fallback | CCXT Bitget pro | 1/3 |
| Standard risk-adjusted analyzers + walk-forward | Backtrader | 5 |
