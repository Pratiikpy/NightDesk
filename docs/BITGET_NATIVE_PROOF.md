# Bitget Native Proof

NightDesk is built around Bitget tokenized-stock agents, not a generic trading demo.

## Proof Points

| Requirement | NightDesk Evidence |
| --- | --- |
| Bitget public market data | `evidence/bitget-live/live-market-snapshot.json` |
| Bitget read-only posture | `evidence/bitget-live/read-only-proof.md` |
| Bitget tokenized-stock universe | `src/universe.ts` and paper logs under `evidence/trading-log/` |
| Agent Hub compatibility | `evidence/bitget-live/agent-hub-compat-report.md` |
| MCP-style external tool usage | `evidence/integration/mcp-tool-call-log.jsonl` |
| External agent integration | `sdk/examples/external-agent.ts` and `evidence/integration/external-agent-run.jsonl` |
| Paper log matching Bitget requirement | `evidence/trading-log/nightdesk-paper-trading-log.csv` |
| Env-only credentials | `.env.example`, `docs/SECURITY_BOUNDARIES.md` |
| No accidental write path | live trading disabled by default; see `evidence/security/security-boundaries.md` |

## Safety Posture

- Public/read-only market data works without trading credentials.
- Private/write operations are not required for the submitted proof.
- Live execution is disabled unless `NIGHTDESK_ENABLE_LIVE_TRADE=1`.
- Live path is dust-capped, limit-order-only, no leverage, and still requires certificates/gates.
- Secrets are not written into evidence logs.

## Judge Command

```bash
npm run bitget:read-only-proof
npm run bitget:compat
npm run external:proof
npm run judge:max
```

## Claim Boundary

NightDesk claims Bitget-native read-only and paper-trading proof today. It does not claim a real live fill unless a dust receipt is explicitly executed and included under `evidence/live-receipt/`.
