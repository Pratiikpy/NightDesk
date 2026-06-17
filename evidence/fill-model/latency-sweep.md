# Latency / Slippage Sweep

One buy order on a fixed rising price path (100.00 → 100.50 over 300ms), filled under increasing
venue latency. An order cannot fill before `submitTs + latency`, so higher latency fills later and
worse; seeded, tick-quantized slippage is applied on top. Deterministic (seeded PRNG) — reproducible.

| Latency (ms) | Arrival (ms) | Raw fill | Slipped fill | Slippage cost |
|---|---|---|---|---|
| 0 | 0 | 100.00 | 100.00 | 0.00 |
| 50 | 50 | 100.08 | 100.10 | 0.10 |
| 250 | 250 | 100.42 | 100.42 | 0.42 |

> Fill realism is modeled, not assumed: latency delays the fill and slippage is quantized to the
> instrument tick. Re-run produces identical numbers (seeded).
