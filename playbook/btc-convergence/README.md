# BTC Mean-Reversion Convergence

A deterministic mean-reversion Playbook on **BTC perpetual futures**. It buys sharp stretches
below the recent price path and exits as price reverts. Signal-only, transparent, rules-based.

This is the **methodology + platform-integration proof** for the NightDesk project (see
`../../nightdesk-prd.md`). NightDesk's edge is convergence/mean-reversion on tokenized US stocks
(rTokens); because Bitget Playbook's managed historical-data provider covers crypto pairs and
does **not** carry Bitget rTokens, the rToken-specific convergence is backtested and sim-traded
on our own open-source **BitSim** sandbox against real recorded Bitget rToken order books, while
this Playbook proves the same convergence methodology runs end-to-end on Bitget Playbook with
real, verifiable backtest metrics.

## How it works

- **策略 (Strategy):** short-horizon mean reversion on BTC perpetual. Assumes price snaps back
  toward its recent path after stretching unusually far from it.
- **开仓 (Entry):** opens a long when price has stretched sharply below its recent path (an
  outsized washout treated as a temporary dislocation).
- **平仓 (Exit):** closes once price reverts back toward the path, capturing the snap-back. No
  separate take-profit/stop target — reversion is the objective.
- **风险 (Risk):** in strong trends a stretch may be the start of a real move, so reversion never
  arrives and the position sits at a drawdown. News gaps, fees, and slippage erode edge. Past
  backtest results do not guarantee live profit.

## Tunable parameters

- **lookback_period** — history that defines the price path. Longer = smoother, slower.
- **entry_z** — how far below the path price must stretch before entering. Higher = more selective.
- **exit_z** — how close to the path to wait before exiting.
- **leverage** — amplifies upside and drawdown equally.
- **margin_budget** — capital the platform sizes orders against and uses as the return denominator.

## Reading the metrics

`total_return_pct` / `net_pnl` are strategy-basis over the replay window; pair `win_rate` with
`total_trades`. Compare against buy-and-hold of BTC over the same window.
