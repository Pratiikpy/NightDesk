# NightDesk Outcome Audit

Pass: 8
Warn: 4
Fail: 0

| Severity | Check | Detail |
| --- | --- | --- |
| PASS | required outcome files | 8 outcome files present |
| PASS | Bitget-required paper log fields and actions | 19 rows, 8 fills, 11 blocks, 19 assets |
| WARN | single-session paper economics | paper-session net -0.3345 USDT; this proves execution/logging but not standalone profit |
| PASS | guarded replay economics | guarded replay net +4.3440 USDT across 38 fills and 16883 blocks |
| WARN | arena outcome honesty | NightDesk ranks #11/12 by arena PnL (0.9963 USDT); best is momentum_agent at 9.9747 USDT. Pitch as safety gateway, not max-PnL bot. |
| PASS | same-agent guarded delta is present | 5 same-agent pairs; pnl improved in 0, drawdown reduced in 2 |
| PASS | arena downside behavior | NightDesk max DD 0.8058 USDT is at/below arena median 1.6593 |
| WARN | walk-forward differential | no demonstrated walk-forward PnL uplift yet: positive=0, negative=0, total_delta=0.0000 USDT |
| WARN | OOS session depth | 4 sessions, 3 active. This is enough for a hackathon evidence pack, not enough for a production alpha claim. |
| PASS | fill realism outcome cases | 7/7 fill realism cases pass |
| PASS | external integration proof | 5 external agent calls, verdicts: ALLOW |
| PASS | live/read-only Bitget proof | read-only live/public snapshot present for RAAPLUSDT |

Interpretation: `FAIL` means the evidence pack is internally broken. `WARN` means the artifact is valid but the claim must be framed carefully in the pitch.
