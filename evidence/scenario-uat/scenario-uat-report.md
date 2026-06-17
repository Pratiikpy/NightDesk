# NightDesk Scenario UAT Report

Status: PASS
Scenarios: 15

| Scenario | Persona | Status | Commands | Artifacts | Notes |
| --- | --- | --- | ---: | ---: | --- |
| Judge opens repo fresh | Hackathon judge | PASS | 4 | 4/4 | scenario passed |
| Judge wants paper trading record | Trading-track judge | PASS | 2 | 4/4 | scenario passed |
| External agent uses NightDesk | Infra judge / third-party developer | PASS | 3 | 3/3 | scenario passed |
| Malicious agent attacks gateway | Adversarial agent | PASS | 3 | 2/2 | scenario passed |
| Quant judge checks overfitting | Skeptical quant judge | PASS | 4 | 5/5 | scenario passed |
| Judge cares only about PnL | PnL-first judge | PASS | 2 | 4/4 | scenario passed |
| Safety judge checks certificates and ledger | Safety-focused judge | PASS | 4 | 2/2 | scenario passed |
| Execution realism judge checks fills | Execution realism judge | PASS | 3 | 4/4 | scenario passed |
| Bitget-native proof | Bitget ecosystem judge | PASS | 3 | 4/4 | scenario passed |
| Ops judge checks reliability | Ops/reliability judge | PASS | 3 | 3/3 | scenario passed |
| Secrets and security review | Security judge | PASS | 2 | 2/2 | scenario passed |
| Documentation consistency | Confused human / judge | PASS | 1 | 1/1 | scenario passed |
| Judge opens cockpit | Demo judge | PASS | 1 | 1/1 | scenario passed |
| Offline/degraded mode | Judge running during provider trouble | PASS | 3 | 2/2 | scenario passed |
| OOS daemon is running and useful | Forward-evidence judge | PASS | 2 | 3/3 | scenario passed |

## Known Boundaries

- Fresh public clone proof still requires running against the public GitHub URL or CI environment.
- OOS evidence continues to grow over future market sessions.
- Live trade receipt remains dry-run unless an explicit dust execution is performed.
- Championship PnL is current-recording paper evidence, not a guaranteed future alpha claim.
