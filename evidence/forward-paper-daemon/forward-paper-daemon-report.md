# Forward Paper Daemon

Run ID: forward_2026-06-18T03-37-29-624Z
Frozen champion: perp_gap_fade_e0p35_x0_tp2_sl0p75_h9999_n0p5_m2
Frozen at: 2026-06-17T16:08:20.334Z (LOCKED)
Champion config hash: d62fbc88c1ea6482…
Run fingerprint: 93efbe2ec62ba978… (same locked champion + same recordings reproduce this exactly)

## Forward / out-of-sample track record (the honest number)
Forward sessions (recorded after the freeze): 1
Forward PnL: -2.0498 USDT
Forward trades: 1

## All sessions (forward + in-sample replay)
Sessions processed: 5
Total PnL: 45.3395 USDT
Total trades: 8

Rule: the champion config is loaded from `frozen-champion.locked.json` (or `frozen-champion.json`)
and is never changed during the daemon run. Sessions dated after `frozen_at` are genuinely
out-of-sample; the forward record strengthens as more `data/snapshots/*.jsonl` days are recorded.
