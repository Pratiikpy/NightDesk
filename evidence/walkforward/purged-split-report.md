# Purged Walk-Forward Split Report

Purpose: document the anti-leakage policy for time-series strategy validation.

Rule: no threshold may be selected using the test fold. Adjacent sessions are treated as embargoed/purged because gap-to-open labels can overlap in time and market regime.

| Fold | Train | Purged Train | Test | Embargo | Test PnL | Trades | Blocks |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
| leave_2026-06-14_out | 5 | 4 | 2026-06-14 | 1 adjacent session | 0.000000 | 0 | 0 |
| leave_2026-06-15_out | 5 | 4 | 2026-06-15 | 1 adjacent session | 3.510092 | 17 | 16561 |
| leave_2026-06-16_out | 5 | 4 | 2026-06-16 | 1 adjacent session | 1.255184 | 10 | 40 |
| leave_2026-06-17_out | 5 | 4 | 2026-06-17 | 1 adjacent session | -3.946890 | 17 | 307 |
| leave_2026-06-18_out | 5 | 4 | 2026-06-18 | 1 adjacent session | -0.496271 | 3 | 683 |
| leave_2026-06-24_out | 5 | 4 | 2026-06-24 | 1 adjacent session | 0.000000 | 0 | 0 |

This is a small-sample report until the OOS daemon collects more sessions. It exists to make the leakage policy explicit, not to claim final statistical proof.
