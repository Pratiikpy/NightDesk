# NightDesk PnL Claim Standard

NightDesk's core claim is safety-adjusted execution quality for tokenized-stock agents. The repo also includes a separate raw-PnL alpha championship mode that searches recorded sessions for the most profitable spot policy, with the result labeled as in-sample research evidence until it survives future sessions.

## Claim Levels

| Level | Claim | Required Evidence |
| --- | --- | --- |
| 0 | Runnable paper record | Bitget-style CSV with timestamp, asset, direction, price, quantity, and account balance change |
| 1 | Guarded replay can profit | Positive guarded paper replay with costs, blocks, and ledger hash |
| 2 | Guarded improves the same agent | Same policy, same market path, guarded vs unguarded comparison |
| 3 | OOS downside improvement | Multi-session OOS report with PnL, drawdown, blocked loss, and missed profit |
| 4 | Tradeable execution survives costs | Fill realism, cost sweep, slippage/liquidity checks, and tradeability bridge |
| 5 | Bitget production plumbing | Live read-only Bitget proof and optional explicitly gated dust/sim receipt |

Current submission claim level is conservative: Level 2 evidence is generated, Level 3 is early because only a small number of recorded sessions exist, and Level 4 is partially supported by fill-realism and historical cost sweeps.

## What Counts As PnL

NightDesk separates four economic outputs:

1. Execution record: proves the agent can create valid paper/live trading records.
2. Safety uplift: same agent with and without NightDesk, measuring loss avoided, drawdown reduction, false blocks, and net PnL.
3. Alpha research: historical signal tests after costs and fill constraints. This is research until validated out of sample and through executable fills.
4. Raw-PnL championship: a parameter-scanned paper policy that maximizes net USDT on recorded sessions and exports a Bitget-style paper trading log. This is useful for the hackathon profit story, but must be labeled as optimized research unless the selected config is frozen and replayed on new recordings.

## Approved Claim

NightDesk improves the economic quality of agent execution by rejecting unsafe intents, capping risky size, enforcing tradeability checks, and preserving only the subset of tokenized-stock convergence trades that survive cost, liquidity, event, and certificate constraints.

## Disallowed Claim

NightDesk should not be described as guaranteed alpha or as the validated highest future-PnL bot. It can be described as having a raw-PnL championship mode that found the highest paper PnL on the current recorded sessions, with same-sample optimization clearly disclosed.

Championship Mode freezes two separate champions:

- PnL Champion: maximizes paper PnL under hard safety invariants.
- Safety Champion: optimizes safer risk-adjusted execution under the same hard invariants.

These must remain separate. The PnL Champion protects the hackathon green-number story; the Safety Champion protects the production and infrastructure thesis.
