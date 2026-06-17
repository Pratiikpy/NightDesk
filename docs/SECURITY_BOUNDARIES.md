# NightDesk Security Boundaries

NightDesk is read-only and paper-first by default.

Rules:

- `NIGHTDESK_ENABLE_LIVE_TRADE=1` is required before any live write path can be considered.
- Live mode is capped to dust-sized limit orders by default: max 10 USDT notional, no leverage.
- Market orders are rejected in the live boundary.
- Remote dashboard/API access must use `API_AUTH_KEY`.
- Shell-capable tools are disabled unless `NIGHTDESK_ENABLE_SHELL_TOOLS=1`.
- Secrets must never be printed into logs, evidence files, screenshots, or run cards.
- MCP/SDK calls cannot bypass the certificate firewall and hard risk gates.

Evidence:

- `test/security-boundary.test.ts`
- `evidence/security/security-boundaries.md`
- `evidence/security/security-boundaries.json`
