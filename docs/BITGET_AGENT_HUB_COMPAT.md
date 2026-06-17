# Bitget Agent Hub Compatibility

NightDesk is designed to sit before Bitget execution as a safety gateway for tokenized-stock agents.

## Integration shape

```txt
External agent / Agent Hub tool
  -> NightDesk MCP or HTTP firewall
  -> signed NightDeskCertificate
  -> ALLOW / ALLOW_CAPPED / REJECT
  -> PaperPit/BitSim paper adapter or future Bitget live adapter
  -> CSV/JSONL trading log
  -> signed ledger hash
```

## Current surfaces

- **MCP:** `npm run mcp`
  - `evaluate_intent`
  - `certify_token`
  - `score_universe`
  - `get_risk_desk`
  - `get_true_gap`
  - `verify_ledger`
  - `get_scorecard`
- **HTTP:** `npm run dashboard`
  - `GET /api/firewall?ticker=NVDA&side=buy&sizeUsd=50`
- **SDK:** `sdk/nightdesk-client.ts`
  - `evaluateIntent(intent)`
  - `allowedSize(intent, verdict)`
- **Evidence:** `npm run paper-session`
  - `evidence/trading-log/nightdesk-paper-trading-log.csv`
  - `evidence/trading-log/run-summary.md`

## Safety defaults

- Market data is read-only by default.
- No Bitget private key is required for the paper session or judge pack.
- Any future live adapter must use environment variables only for credentials.
- Write/trading mode must be explicit; paper mode is the default evidence path.
- A trade intent without a valid, unexpired, ticker-matching certificate is rejected.

## Execution architecture standards

NightDesk's execution layer is a small, reproducible TypeScript layer (no heavyweight engine
dependency). The standards it holds itself to:

- **Event-driven run log:** NightDesk records market snapshot, certificate, intent, firewall verdict,
  simulated order/fill, account snapshot, and ledger signing events.
- **Research/paper/live parity:** the same trade intent and certificate contract works in fixture
  replay, paper session, and a future live adapter. Only the execution adapter changes.
- **Adapter boundary:** PaperPit/BitSim is the current execution adapter; a Bitget live adapter can
  implement the same certified-order input/output later.
- **Custom data as first-class data:** certificates, firewall verdicts, gate reports, block reasons,
  and ledger hashes are logged alongside prices and fills.

The submission path stays a small, reproducible TypeScript evidence layer specific to Bitget tokenized
US stocks — deliberately not a generic trading engine.
