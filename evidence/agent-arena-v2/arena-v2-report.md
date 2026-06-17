# NightDesk Agent Arena v2

Recording: data/snapshots/2026-06-15.jsonl
Snapshots with equity anchors: 1452

| Agent | Fills | Blocks | Ending USDT | Net PnL | Max DD |
| --- | ---: | ---: | ---: | ---: | ---: |
| naive_gap_agent | 34 | 16561 | 1003.50 | 3.50 | 3.28 |
| naive_gap_agent_guarded | 34 | 16561 | 1002.86 | 2.86 | 2.36 |
| perp_trust_agent | 32 | 8 | 1007.79 | 7.79 | 1.11 |
| perp_trust_agent_guarded | 30 | 2003 | 1002.23 | 2.23 | 3.39 |
| momentum_agent | 38 | 1963 | 1009.97 | 9.97 | 0.91 |
| momentum_agent_guarded | 36 | 16542 | 1002.35 | 2.35 | 1.66 |
| news_blind_agent | 34 | 16561 | 1003.50 | 3.50 | 3.28 |
| news_blind_agent_guarded | 34 | 16561 | 1002.86 | 2.86 | 2.36 |
| random_agent | 38 | 0 | 1009.77 | 9.77 | 0.95 |
| random_agent_guarded | 38 | 1328 | 1002.70 | 2.70 | 1.17 |
| qwen_council_agent | 20 | 0 | 1000.92 | 0.92 | 1.08 |
| nightdesk_guarded_agent | 20 | 0 | 1001.00 | 1.00 | 0.81 |

Each agent exports a Bitget-style paper trading CSV. NightDesk's point is not fake maximum turnover; it is certificate-gated execution with rejected unsafe intents preserved in the record.
