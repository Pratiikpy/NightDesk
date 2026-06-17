# Claim Ledger

NightDesk uses a claim-ledger format so judges can map every major statement to acceptance criteria and evidence.

## Claims

| Claim | Evidence | Reproduce |
| --- | --- | --- |
| NightDesk produces a Bitget-style paper trading log | `evidence/trading-log/nightdesk-paper-trading-log.csv` | `npm run paper-session` |
| NightDesk searches alpha candidates and freezes a champion | `evidence/alpha-factory/manifest.json` | `npm run alpha:factory` |
| NightDesk has a separate PnL Champion and Safety Champion | `evidence/championship/` | `npm run championship:search` |
| NightDesk rejects unsafe external-agent intents | `evidence/integration/external-agent-run.jsonl` | `npm run external:proof` |
| NightDesk is Bitget-native/read-only by default | `evidence/bitget-live/` | `npm run bitget:read-only-proof` |
| NightDesk tracks OOS sessions over time | `evidence/oos/session-bank/` | `npm run oos:session-bank` |
| NightDesk does not silently overclaim alpha | `docs/PNL_CLAIM_STANDARD.md` | read doc + `npm run evidence:verify` |

## Machine-Readable Ledger

The generated claim ledger is under:

```txt
evidence/claims/claims-manifest.json
evidence/claims/claims-report.md
```

Regenerate:

```bash
npm run claims:verify
```

## Rule

If a claim is not backed by a command and an evidence file, it should not appear in the submission pitch.
