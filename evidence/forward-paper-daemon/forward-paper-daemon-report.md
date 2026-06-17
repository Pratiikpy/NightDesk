# Forward Paper Daemon

Run ID: forward_2026-06-17T17-57-19-419Z
Frozen champion: perp_gap_fade_e0p35_x0_tp2_sl0p75_h9999_n0p5_m2
Frozen at: 2026-06-17T16:08:20.334Z (LOCKED)

## Forward / out-of-sample track record (the honest number)
Forward sessions (recorded after the freeze): 0
Forward PnL: 0.0000 USDT
Forward trades: 0

## All sessions (forward + in-sample replay)
Sessions processed: 4
Total PnL: 47.8575 USDT
Total trades: 5

Rule: the champion config is loaded from `frozen-champion.locked.json` (or `frozen-champion.json`)
and is never changed during the daemon run. Sessions dated after `frozen_at` are genuinely
out-of-sample; the forward record strengthens as more `data/snapshots/*.jsonl` days are recorded.
