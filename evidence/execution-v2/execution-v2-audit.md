# Execution Engine v2

Overall: **PASS** (8/8)

| Requirement | Result | Detail |
|---|---:|---|
| Depth-aware ordered event replay is deterministic | PASS | Ordered market/order events reproduce the same fill/account fingerprint and reject sequence or time regressions. |
| Latency degrades execution on a deterministic price path | PASS | 3 latency points with increasing adverse cost. |
| Partial fills, queue position, and venue rejects are enforced | PASS | Resting quantity survives partial execution, aggressor volume clears queue ahead, and invalid venue increments fail before accounting. |
| Cancel/fill races and fill invariants have adversarial tests | PASS | Late fills are accepted only before cancel acknowledgement; depth and queue conservation are property-tested. |
| Implementation shortfall is attributed | PASS | Delay, execution impact, and fees are separated; live depth cases report fee-inclusive shortfall by tier. |
| Live public books calibrate simulation error by liquidity tier | PASS | 19/19 symbols, 114 cases, 7 with executable two-sided depth; no-book symbols are D/untradeable. |
| Paper accounts reconcile exactly and recover after restart | PASS | Append-only account events rebuild balances/positions exactly, detect drift, and restore from disk after process restart. |
| No fantasy fills | PASS | Limits never consume worse prices, visible/depth liquidity caps fills, and unfilled quantities remain pending. |
