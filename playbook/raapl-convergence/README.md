# rAAPL Off-Hours Convergence

A deterministic mean-reversion Playbook for **tokenized Apple (rAAPL) spot** on Bitget. It
harvests the temporary discounts that open up when the US market is closed and tokenized-stock
liquidity is thin, then exits as price converges back toward fair value. Direction-neutral,
long-only on spot, signal-only.

This is the published-backtest arm of the NightDesk project (see `../../nightdesk-prd.md`): the
deterministic strategy lives here on Bitget Playbook for verifiable on-platform backtest
evidence, while the LLM bull/bear/risk council runs in the live NightDesk runtime (LLM-driven
strategies cannot be backtested in Playbook).

## How it works

- **策略 (Strategy):** off-hours mean reversion on rAAPL spot. It assumes the discount/premium an
  rToken shows versus its fair value while Wall Street is closed is temporary and reverts once
  liquidity returns.
- **开仓 (Entry):** opens a long when price has stretched unusually far below its recent
  fair-value path (a meaningful discount).
- **平仓 (Exit):** closes the position once price reverts back toward fair value, capturing the
  convergence. No separate take-profit/stop target — reversion is the objective.
- **风险 (Risk):** if a discount is not temporary (a real, lasting slide on news), reversion never
  arrives and the position sits at a drawdown. Thin weekend liquidity, fees, and slippage erode
  edge. Past backtest results do not guarantee live profit.

## Tunable parameters

- **lookback_period** — how much history defines the fair-value path. Longer = smoother, slower.
- **entry_z** — how far below fair value price must stretch before entering. Higher = more
  selective, fewer trades.
- **exit_z** — how close to fair value to wait before exiting. Lower = holds for fuller reversion.
- **margin_budget** — per-strategy capital the platform sizes orders against and uses as the
  return-percentage denominator.

## Reading the metrics

`total_return_pct` and `net_pnl` are strategy-basis results over the replay window; pair
`win_rate` with `total_trades` (a high win rate over very few trades is not significant). Compare
strategy return against buy-and-hold of rAAPL over the same window.
