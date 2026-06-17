# Bitget Agent Hub Compatibility Report

NightDesk mirrors the Agent Hub posture: public market data without credentials, private/write paths via env-only credentials, read-only default, and agent-facing MCP/SDK tools.

| Capability | Status | Evidence |
|---|---|---|
| public_market_data | verified | live-market-snapshot.json |
| read_only_default | verified | read-only-proof.md |
| env_only_private_credentials | documented | README.md / SECURITY_BOUNDARIES.md |
| mcp_evaluate_intent | verified | evidence/integration/mcp-tool-call-log.jsonl |
| sdk_external_agent | verified | sdk/examples/external-agent.ts |
| certificate_from_live_data | verified | certificate-from-live-data.json |
| write_gated_live_path | documented | evidence/security/security-boundaries.md |
