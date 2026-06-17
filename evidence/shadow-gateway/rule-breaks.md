# Shadow Gateway

Compares each external agent's unrestricted path against its NightDesk-guarded path, plus always-block and reckless baselines.

| Agent | Actual PnL | Guarded PnL | Missed Profit | Blocked Loss | Verdict |
|---|---:|---:|---:|---:|---|
| naive_gap_agent | 3.5049 | 2.8603 | 0.6446 | 0.0000 | gateway_helped_or_reduced_risk |
| perp_trust_agent | 7.7914 | 2.2310 | 5.5604 | 0.0000 | gateway_reduced_profit_on_this_sample |
| momentum_agent | 9.9747 | 2.3535 | 7.6211 | 0.0000 | gateway_reduced_profit_on_this_sample |
| news_blind_agent | 3.5049 | 2.8603 | 0.6446 | 0.0000 | gateway_helped_or_reduced_risk |
| random_agent | 9.7685 | 2.6970 | 7.0715 | 0.0000 | gateway_reduced_profit_on_this_sample |

This report intentionally shows when the gateway reduces raw PnL. The claim is safety-adjusted execution quality, not hiding missed winners.
