# NightDesk Walk-Forward PnL Evidence

Sessions: 6
Folds: 6

Method: leave-one-session-out over recorded snapshot files. This is intentionally small until more recordings exist; the command scales as new sessions are added under `data/snapshots/`.

| Fold | Test | Guarded PnL | Unguarded PnL | Delta | Blocks | Trades |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| leave_2026-06-14_out | 2026-06-14 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| leave_2026-06-15_out | 2026-06-15 | 3.51 | 3.51 | 0.00 | 16561 | 17 |
| leave_2026-06-16_out | 2026-06-16 | 1.26 | 1.26 | 0.00 | 40 | 10 |
| leave_2026-06-17_out | 2026-06-17 | -3.95 | -3.95 | 0.00 | 307 | 17 |
| leave_2026-06-18_out | 2026-06-18 | -0.50 | -0.50 | 0.00 | 683 | 3 |
| leave_2026-06-24_out | 2026-06-24 | 0.00 | 0.00 | 0.00 | 0 | 0 |

The right claim is downside-aware execution evidence, not universal alpha. NightDesk is evaluated as a safety gateway in front of agents.
