# Data Source Health Matrix

| Source | Status | Role | Evidence |
|---|---|---|---|
| Bitget rToken quote | ok | live/public market proof | symbol=RAAPLUSDT |
| Bitget smoke log | ok | read-only adapter proof | evidence/bitget-live/bitget-smoke-log.jsonl |
| NYSE/Yahoo anchor | ok | fair-value anchor study | evidence/oos/session-summary.csv |
| Recorded snapshots | ok | replay/OOS/alpha factory base | data/snapshots/*.jsonl |
| Alpha Factory | ok | strategy research data | evidence/alpha-factory/manifest.json |
| Paper execution | ok | Bitget-required trading record | evidence/trading-log/nightdesk-paper-trading-log.csv |
| Ledger | ok | tamper-evident audit | evidence/trading-log/ledger-verification.txt |
| Qwen council | ok | optional live council path | env presence only; key not printed |
| MCP/SDK integration | ok | external-agent proof | evidence/integration/mcp-tool-call-log.jsonl |
