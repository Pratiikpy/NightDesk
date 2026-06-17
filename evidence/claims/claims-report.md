# NightDesk Claim Ledger

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| NightDesk produces Bitget-style paper trading records with timestamp, asset, direction, price, quantity, and balance change. | verified | evidence/trading-log/nightdesk-paper-trading-log.csv<br>evidence/trading-log/run-summary.md<br>evidence:verify | Paper record is execution evidence, not a live capital claim. |
| NightDesk autonomously searches strategy candidates, rejects fragile configs, freezes a champion, and exports expected-vs-actual evidence. | verified | evidence/alpha-factory/manifest.json<br>evidence/alpha-factory/trial-registry.jsonl<br>evidence/alpha-factory/frozen-champion.json | Current dataset has 3 recordings; future OOS sessions remain the next proof layer. |
| NightDesk can compete on raw PnL over current recordings through a reproducible Alpha Championship. | verified | evidence/alpha-championship/manifest.json<br>evidence/alpha-championship/champion-paper-trading-log.csv | In-sample/current-recording championship, not guaranteed future alpha. |
| Unsafe external-agent intents are rejected or capped before execution. | verified | evidence/sample-outputs/unsafe-sell-verdict.json<br>evidence/integration/external-agent-run.jsonl<br>test/kernel.property.test.ts | Live trading remains explicitly gated and disabled by default. |
| NightDesk can generate certificates from live public Bitget market data without credentials. | verified | evidence/bitget-live/read-only-proof.md<br>evidence/bitget-live/live-market-snapshot.json | Private trading endpoints are not required for judge reproduction. |
| NightDesk measures whether guarding helps by comparing actual, guarded, reckless, and always-block counterfactuals. | verified | evidence/shadow-gateway/actual-vs-guarded.csv<br>evidence/shadow-gateway/missed-profit.csv<br>evidence/shadow-gateway/blocked-loss.csv | This report is honest when guarding reduces raw PnL on a sample. |
