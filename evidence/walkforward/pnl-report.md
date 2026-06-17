# NightDesk Walk-Forward PnL Evidence

Sessions: 4
Folds: 4

Method: leave-one-session-out over recorded snapshot files. This is intentionally small until more recordings exist; the command scales as new sessions are added under `data/snapshots/`.

| Fold | Test | Guarded PnL | Unguarded PnL | Delta | Blocks | Trades |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| leave_2026-06-14_out | 2026-06-14 | 0.00 | 0.00 | 0.00 | 0 | 0 |
| leave_2026-06-15_out | 2026-06-15 | 3.51 | 3.51 | 0.00 | 16561 | 17 |
| leave_2026-06-16_out | 2026-06-16 | 1.26 | 1.26 | 0.00 | 40 | 10 |
| leave_2026-06-17_out | 2026-06-17 | 2.19 | 2.19 | 0.00 | 237 | 16 |

The right claim is downside-aware execution evidence, not universal alpha. NightDesk is evaluated as a safety gateway in front of agents.
