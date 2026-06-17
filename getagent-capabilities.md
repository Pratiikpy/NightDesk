# GetAgent / Playbook Skill — Capabilities (discovered Jun 12, 2026)

Skill installed at `C:\Users\prate\.claude\skills\getagent` (v0.3.0). ACCESS-KEY in `.env` (GETAGENT_API_KEY / PLAYBOOK_API_KEY). Below = what the bundled reference docs reveal. **Code runs in GetAgent Cloud sandbox, NOT locally** — local machine only does static validation + control-plane API calls (upload/run/publish).

## How it works
- Author strategy in Python against `getagent.*` modules → `python3 scripts/validate.py ./pkg/` → upload → sandbox backtest → read metrics → publish.
- Sandbox-only SDK modules: `getagent.data`, `getagent.trade`, `getagent.llm`, `getagent.backtest`, `getagent.runtime`. Backtest engine is Nautilus-based.
- Blocked in strategy code: `requests`, `httpx`, `ccxt`, `yfinance`, etc. (no direct HTTP — must use `getagent.data`).

## 🔑 Build-changing discoveries

### 1. rTokens are NATIVELY supported (answers open Q: Playbook stock support = YES)
SKILL.md uses **`"RAAPLUSDT"`** as a literal example symbol. The sandbox's `crypto.spot.*` / `crypto.futures.*` endpoints (kline, ticker, funding_rate, taker_volume, open_interest, long_short_ratio, trades) accept exchange-native rToken + perp symbols via the `bitget_data` provider. → We can backtest the convergence strategy on real rToken+perp data inside the sandbox.

### 2. The sandbox provides the TRUE underlying US equity price
`getagent.data.equity.*` domain includes:
- **`equity.price.historical` / `equity.price.quote`** → the actual NYSE/Nasdaq stock price. This is the *ground-truth fair value* PegWatch needs — better than the perp-proxy we planned. We can compute real peg-tracking error in backtests.
- **`equity.calendar.earnings`** → EPS actual/consensus/surprise + `reporting_time` ("after market close"). **Answers our showcase calendar need** — verify MU and find all in-window earnings programmatically, no scraping.
- **`equity.calendar.dividend`** → ex-div dates + amounts. **Solves the Ondo sValue total-return trap (research A6):** we can mask/adjust dividend drift instead of misreading it as a depeg.
- **`equity.calendar.splits`** → split numerator/denominator. **Kills the catastrophic split false-signal risk.**
- **`equity.calendar.events`** → economic events (FOMC etc.).
- Plus deep fundamentals/estimates/ownership/short-interest if ever needed.

### 3. LLM constraint (affects NightDesk council design)
`getagent.llm` exists in-sandbox BUT: LLM-backed strategies are **live/evaluation-only**, require `runtime_profile: llm_bounded` + `backtest_support: none`. → The bull/bear/risk **council cannot be inside a backtested Playbook**. Backtested Playbooks must be deterministic rule-strategies. The LLM council stays in our own NightDesk runtime (qwen3.6-plus). This cleanly splits the two tracks:
  - **Playbook (Track-evidence):** deterministic convergence/basis rule-strategy, backtested on real rToken+equity data, published → satisfies "Playbook module used" + "verifiable backtest records" + "uses Bitget US stock data."
  - **NightDesk (the loop):** LLM council + live BitSim execution + gates — our own infra.

## Strategic implication
The Playbook sandbox is a second, independent evidence engine that directly hits 3 Track-3 judging boxes (Bitget tool used, verifiable backtests, Bitget US-stock data) AND gives us real equity prices to validate PegWatch's fair-value model. Two of our hardest research risks (sValue dividend trap, split false-signal) now have a clean data source. Plan: build a deterministic convergence Playbook here for backtest evidence; keep the LLM council in NightDesk.

## LIVE VERIFICATION (Jun 14, 2026) — real upload + backtest runs

Built two Playbook packages under `playbook/`, both pass the official `validate.py`:
- **`raapl-convergence`** (rAAPL spot mean-reversion) — uploaded OK (draft `15f37644…`). Backtest **FAILED** with a real, important finding: the Playbook sandbox's `data.crypto.spot.kline` is backed by **CoinGlass, which does NOT carry Bitget rTokens** (`"The requested pair does not exist on the exchange"`). So **rTokens cannot be backtested inside Playbook** — their price history isn't in the managed data provider.
- **`btc-convergence`** (same convergence methodology on BTC perp) — uploaded + **backtest COMPLETED** (run `pbrun-dc30391515e3`). Real Nautilus metrics: 20 trades, win_rate 0.5, total_return −0.0543%, Sharpe −2.83, max_dd 0.069%, real fee diagnostics. This is a **verifiable on-platform Bitget Playbook backtest record.**

### Consequence for the evidence story (honest + accurate)
- Playbook proves: we use the Bitget Playbook tool end-to-end (author → validate → upload → backtest) with a **real completed backtest record** — Track-3 "uses Bitget tools + verifiable backtest" ✅ (methodology validated on crypto, the data the platform actually serves).
- The **rToken-specific** convergence evidence lives in our own **BitSim** (real recorded Bitget rToken quotes/books) + the live NightDesk loop — because Playbook's data provider can't serve rTokens. This is the truthful framing for the submission: "methodology backtested on Playbook; rToken convergence sim-traded on our open-source BitSim against real Bitget rToken data."
- ⚠️ The earlier assumption that the Playbook sandbox exposes real equity prices / dividend / split calendars for *our* use is now **doubtful**: `equity.price.historical` market enum is `a_share`/`hk` (not US), and the crypto endpoints are CoinGlass. Treat the sandbox `equity.*` US coverage as UNVERIFIED — do not claim it without a passing run.

Both packages remain **temporary drafts** (not published). Publishing to the public marketplace is a separate, outward-facing step left for explicit go-ahead.
