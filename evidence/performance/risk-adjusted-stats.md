# Risk-Adjusted Performance

Per-period (per-session) statistics on NightDesk's paper-trading record. Ratios are NOT annualized
(the session series is short and irregular — annualizing would invent precision). Any block with
n < 10 reports its numbers but is flagged **not yet statistically reliable**.

## Forward champion — FORWARD (out-of-sample) sessions only

Source: `evidence/forward-paper-daemon/session-results.csv (mode=forward_oos_paper)`
Sessions (n): **0** — NOT yet reliable. n=0 < 10: ratios are reported but NOT yet statistically reliable (too few observations). They strengthen as the forward record grows.

| Metric | Value |
|---|---|
| Total PnL | 0.00 USDT |
| Total return | 0.00% |
| Mean return / session | 0.000% |
| Sharpe (per session) | 0.00 |
| Sortino (per session) | 0.00 |
| Calmar | 0.00 |
| Max drawdown | 0.00% |
| Profit factor | 0.00 |
| Expectancy / session | 0.00 USDT |
| Win rate | 0.0% (0W / 0L) |

## Forward champion — all sessions (forward + in-sample replay)

Source: `evidence/forward-paper-daemon/session-results.csv`
Sessions (n): **4** — NOT yet reliable. n=4 < 10: ratios are reported but NOT yet statistically reliable (too few observations). They strengthen as the forward record grows.

| Metric | Value |
|---|---|
| Total PnL | 47.86 USDT |
| Total return | 4.79% |
| Mean return / session | 1.196% |
| Sharpe (per session) | 0.84 |
| Sortino (per session) | 0.00 |
| Calmar | 0.00 |
| Max drawdown | 0.00% |
| Profit factor | ∞ (no losing periods) |
| Expectancy / session | 11.96 USDT |
| Win rate | 100.0% (2W / 0L) |

## Raw-PnL championship — global champion, per session (in-sample)

Source: `evidence/alpha-championship/global-champion-session-results.csv`
Sessions (n): **4** — NOT yet reliable. n=4 < 10: ratios are reported but NOT yet statistically reliable (too few observations). They strengthen as the forward record grows.

| Metric | Value |
|---|---|
| Total PnL | 49.59 USDT |
| Total return | 4.96% |
| Mean return / session | 1.240% |
| Sharpe (per session) | 0.85 |
| Sortino (per session) | 0.00 |
| Calmar | 0.00 |
| Max drawdown | 0.00% |
| Profit factor | ∞ (no losing periods) |
| Expectancy / session | 12.40 USDT |
| Win rate | 100.0% (2W / 0L) |

> The forward (out-of-sample) block is the honest headline — it grows as post-freeze sessions are
> recorded. Until it crosses the reliability threshold, treat its ratios as directional only.
