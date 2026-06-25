# Public Stream Resilience Proof

- Public/read-only transport: PASS
- Subscribe and resubscribe: PASS
- Sequence gap detected: PASS
- Gap backfill completed: PASS
- Reconnect backfill completed: PASS
- Sequence regression rejected: PASS
- Application heartbeat: PASS
- Circuit open and half-open recovery: PASS
- Final state after explicit stop: stopped

The scenario is deterministic and network-independent. A separate optional public-stream smoke
command records current provider reachability without making the core verification internet-dependent.
