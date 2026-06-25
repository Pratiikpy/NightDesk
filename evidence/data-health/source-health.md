# Data Source Health Matrix

| Source | Status | Role | Evidence |
|---|---|---|---|
| Bitget rToken quote | ok | live/public market proof | symbol=RAAPLUSDT |
| Bitget smoke log | ok | read-only adapter proof | evidence/bitget-live/bitget-smoke-log.jsonl |
| Bitget public stream | ok | live ticker/book stream receipt | evidence/data-platform/live-stream-smoke.json |
| Stream resilience | ok | reconnect/backfill/heartbeat/circuit proof | evidence/data-platform/stream-resilience-proof.json |
| Point-in-time store | ok | immutable replay and leakage proof | evidence/data-platform/point-in-time-proof.json |
| Equity anchor consensus | ok | independent source agreement | evidence/data-platform/live-anchor-comparison.json |
| NYSE/Yahoo anchor | ok | fair-value anchor study | evidence/oos/session-summary.csv |
| Recorded snapshots | ok | replay/OOS/alpha factory base | data/snapshots/*.jsonl |
| Alpha Factory | ok | strategy research data | evidence/alpha-factory/manifest.json |
| Paper execution | ok | Bitget-required trading record | evidence/trading-log/nightdesk-paper-trading-log.csv |
| Ledger | ok | tamper-evident audit | evidence/trading-log/ledger-verification.txt |
| Qwen council | ok | optional live council path | env presence only; key not printed |
| MCP/SDK integration | ok | external-agent proof | evidence/integration/mcp-tool-call-log.jsonl |
