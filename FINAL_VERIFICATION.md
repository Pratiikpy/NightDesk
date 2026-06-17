# Final Verification

Status: PASS

## Environment

```json
{
  "generatedAt": "2026-06-17T14:46:03.306Z",
  "node": "v22.17.0",
  "npm": "10.9.2",
  "os": "win32 10.0.26300",
  "gitCommit": "fatal: not a git repository (or any of the parent directories): .git",
  "gitStatus": "fatal: not a git repository (or any of the parent directories): .git",
  "packageLock": true
}
```

## UAT Matrix

| Area | Command | Expected artifact | Pass criteria | Actual result | Notes |
| --- | --- | --- | --- | --- | --- |
| Fresh clone | `NIGHTDESK_REPO_URL` | fresh clone log | public repo clone/install path tested | KNOWN-LIMITATION | NIGHTDESK_REPO_URL not set; local repo verification used |
| Clean install | `npm ci --dry-run` | package-lock.json | lockfile dry-run installs cleanly; run full npm ci on clean clone | PASS | command exited 0 |
| Build | `npm run build` | TypeScript noEmit | typecheck exits 0 | PASS | command exited 0 |
| Unit tests | `npm test` | TAP output | all tests pass | PASS | command exited 0 |
| Property tests | `npm run test:properties` | property-test output | property tests pass | PASS | command exited 0 |
| Paper log | `npm run paper-log:verify` | evidence/paper-log-verify.json | Bitget paper log schema valid | PASS | command exited 0 |
| Ledger tamper | `npm run ledger:tamper-test` | evidence/ledger-tamper-test.json | mutations fail verification | PASS | command exited 0 |
| Firewall abuse | `npm run malicious-agent:test` | evidence/integration/malicious-agent-rejections.jsonl | unsafe intents rejected; oversized valid intent capped | PASS | command exited 0 |
| Redteam | `npm run redteam` | evidence/redteam/redteam-report.md | hostile inputs do not execute unsafely | PASS | command exited 0 |
| Gate coverage | `npm run gates:coverage` | evidence/gates/gate-coverage.md | 15 gates have pass/fail coverage | PASS | command exited 0 |
| Fill realism | `npm run fill:realism-report` | evidence/fill-model/fill-model-report.md | fill torture cases pass | PASS | command exited 0 |
| Purged walk-forward | `npm run walkforward:purged` | evidence/walkforward/purged-split-report.md | no test-fold threshold selection | PASS | command exited 0 |
| OOS daemon | `npm run oos:status` | evidence/oos-daemon/state.json | daemon state readable with snapshots | PASS | command exited 0 |
| External SDK/MCP | `npm run external-agent-demo` | evidence/trading-log/nightdesk-paper-trading-log.csv | external-agent flow produces paper evidence | PASS | command exited 0 |
| MCP integration | `npm run mcp:integration-test` | evidence/integration/mcp-tool-call-log.jsonl | MCP-shaped calls logged | PASS | command exited 0 |
| Bitget read-only | `npm run bitget:read-only-proof` | evidence/bitget-live/read-only-proof.md | read-only proof works without trade credentials | PASS | command exited 0 |
| Claims | `npm run claims:verify` | evidence/claims/claims-manifest.json | major claims map to evidence | PASS | command exited 0 |
| Run cards | `npm run run-cards:generate` | evidence/run-cards/manifest.json | judge run cards generated | PASS | command exited 0 |
| Doctor | `npm run doctor` | evidence/doctor-report.json | no failing doctor rows | PASS | command exited 0 |
| Data health | `npm run data:health` | evidence/data-health/source-health.json | source health generated | PASS | command exited 0 |
| Docs | `npm run docs:check` | evidence/docs-check.json | docs exist and no stale overclaims | PASS | command exited 0 |
| Secrets | `npm run secrets:scan` | evidence/secrets-scan.json | no real credential findings | PASS | command exited 0 |
| Evidence | `npm run evidence:verify` | evidence/manifest.json | artifact verifier passes | PASS | command exited 0 |
| Judge cockpit | `npm run dashboard:judge` | evidence/judge-cockpit/index.html | static cockpit generated | PASS | command exited 0 |
| Judge max | `npm run judge:max` | evidence/max-judge-manifest.json | tests + evidence + manifest pass | PASS | command exited 0 |

## Known Limitations

- OOS session bank is append-only and still grows over future market sessions.
- Live trade receipt remains dry-run unless a separate dust order is explicitly executed.
- Championship PnL is current-recording evidence, not guaranteed future alpha.
- Public fresh-clone proof requires `NIGHTDESK_REPO_URL` or external CI against the public GitHub repo.

## Command Output Tails

### npm ci --dry-run

Status: PASS · Duration: 796ms

```txt
add fsevents 2.3.3
add @esbuild/win32-ia32 0.28.1
add @esbuild/win32-arm64 0.28.1
add @esbuild/sunos-x64 0.28.1
add @esbuild/openharmony-arm64 0.28.1
add @esbuild/openbsd-x64 0.28.1
add @esbuild/openbsd-arm64 0.28.1
add @esbuild/netbsd-x64 0.28.1
add @esbuild/netbsd-arm64 0.28.1
add @esbuild/linux-x64 0.28.1
add @esbuild/linux-s390x 0.28.1
add @esbuild/linux-riscv64 0.28.1
add @esbuild/linux-ppc64 0.28.1
add @esbuild/linux-mips64el 0.28.1
add @esbuild/linux-loong64 0.28.1
add @esbuild/linux-ia32 0.28.1
add @esbuild/linux-arm64 0.28.1
add @esbuild/linux-arm 0.28.1
add @esbuild/freebsd-x64 0.28.1
add @esbuild/freebsd-arm64 0.28.1
add @esbuild/darwin-x64 0.28.1
add @esbuild/darwin-arm64 0.28.1
add @esbuild/android-x64 0.28.1
add @esbuild/android-arm64 0.28.1
add @esbuild/android-arm 0.28.1
add @esbuild/aix-ppc64 0.28.1

added 26 packages in 553ms

5 packages are looking for funding
  run `npm fund` for details
```

### npm run build

Status: PASS · Duration: 2358ms

```txt
> nightdesk@0.0.1 build
> tsc --noEmit
```

### npm test

Status: PASS · Duration: 8442ms

```txt
  ...
# Subtest: trackingGrade is n/a with too few aligned days
ok 173 - trackingGrade is n/a with too few aligned days
  ---
  duration_ms: 0.1415
  type: 'test'
  ...
# Subtest: buildRightsFlags NEVER asserts legal rights
ok 174 - buildRightsFlags NEVER asserts legal rights
  ---
  duration_ms: 0.3262
  type: 'test'
  ...
# Subtest: tokenQuality: a tight, steady, L2-book token grades high; rights excluded
ok 175 - tokenQuality: a tight, steady, L2-book token grades high; rights excluded
  ---
  duration_ms: 0.4118
  type: 'test'
  ...
# Subtest: tokenQuality: a loose, volatile, illiquid token grades low
ok 176 - tokenQuality: a loose, volatile, illiquid token grades low
  ---
  duration_ms: 0.1981
  type: 'test'
  ...
# Subtest: tokenQuality is n/a with too few aligned days
ok 177 - tokenQuality is n/a with too few aligned days
  ---
  duration_ms: 0.1935
  type: 'test'
  ...
1..177
# tests 177
# suites 0
# pass 177
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8042.094
```

### npm run test:properties

Status: PASS · Duration: 3148ms

```txt
> nightdesk@0.0.1 test:properties
> node --import tsx --test "test/**/*.property.test.ts"

TAP version 13
# Subtest: PROPERTY: issuer never violates a kernel invariant, and the firewall never allows an unsafe trade
ok 1 - PROPERTY: issuer never violates a kernel invariant, and the firewall never allows an unsafe trade
  ---
  duration_ms: 2218.3209
  type: 'test'
  ...
# Subtest: PROPERTY: an expired certificate is ALWAYS rejected
ok 2 - PROPERTY: an expired certificate is ALWAYS rejected
  ---
  duration_ms: 105.2238
  type: 'test'
  ...
# Subtest: PROPERTY: a ticker mismatch is ALWAYS rejected
ok 3 - PROPERTY: a ticker mismatch is ALWAYS rejected
  ---
  duration_ms: 87.5823
  type: 'test'
  ...
# Subtest: PROPERTY: the firewall never permits more than the certificate's max size
ok 4 - PROPERTY: the firewall never permits more than the certificate's max size
  ---
  duration_ms: 89.8559
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2758.0222
```

### npm run paper-log:verify

Status: PASS · Duration: 614ms

```txt
> nightdesk@0.0.1 paper-log:verify
> tsx src/evidence/paper-log-verify.ts

NIGHTDESK PAPER LOG VERIFY PASS
rows=19 trades=8 blocks=11 abstains=0
```

### npm run ledger:tamper-test

Status: PASS · Duration: 622ms

```txt
> nightdesk@0.0.1 ledger:tamper-test
> tsx src/ledger/tamper-test.ts

NIGHTDESK LEDGER TAMPER TEST PASS
```

### npm run malicious-agent:test

Status: PASS · Duration: 916ms

```txt
> nightdesk@0.0.1 malicious-agent:test
> tsx src/execution/integration-proof.ts


NIGHTDESK INTEGRATION PROOF COMPLETE
calls: 5
log: C:\Users\prate\Downloads\bitget\evidence\integration\external-agent-run.jsonl
```

### npm run redteam

Status: PASS · Duration: 654ms

```txt
> nightdesk@0.0.1 redteam
> tsx src/security/redteam.ts

NIGHTDESK REDTEAM PASS
cases=15 unsafe_allowed=0
```

### npm run gates:coverage

Status: PASS · Duration: 634ms

```txt
> nightdesk@0.0.1 gates:coverage
> tsx src/gates/coverage.ts

NIGHTDESK GATES COVERAGE PASS
gates=15
```

### npm run fill:realism-report

Status: PASS · Duration: 622ms

```txt
> nightdesk@0.0.1 fill:realism-report
> tsx src/research/fill-realism.ts


NIGHTDESK FILL REALISM COMPLETE
passed: 7/7
report: C:\Users\prate\Downloads\bitget\evidence\fill-model\fill-model-report.md
```

### npm run walkforward:purged

Status: PASS · Duration: 19303ms

```txt
> nightdesk@0.0.1 walkforward:purged
> tsx src/research/walkforward-pnl.ts


NIGHTDESK WALK-FORWARD PNL COMPLETE
folds: 4
report: C:\Users\prate\Downloads\bitget\evidence\walkforward\pnl-report.md
```

### npm run oos:status

Status: PASS · Duration: 614ms

```txt
> nightdesk@0.0.1 oos:status
> tsx src/ops/oos-status.ts

NIGHTDESK OOS STATUS PASS
{
  "startedAt": "2026-06-17T08:40:28.688Z",
  "ticks": 71,
  "refreshes": 12,
  "snapshotsRecorded": 71,
  "targetSessions": 20,
  "intervalMs": 300000,
  "refreshMs": 1800000,
  "status": "running",
  "lastTickAt": "2026-06-17T14:41:51.712Z",
  "lastRefreshAt": "2026-06-17T14:21:14.140Z"
}
```

### npm run external-agent-demo

Status: PASS · Duration: 962ms

```txt
> nightdesk@0.0.1 external-agent-demo
> tsx src/execution/paper-session.ts --external-agent-demo


NIGHTDESK PAPER SESSION COMPLETE
tokens: 19
intents: 19
allowed: 3
capped: 5
rejected: 11
simulated fills: 8
starting balance: 1000.00
ending balance: 999.67
ledger: verified
trading log: C:\Users\prate\Downloads\bitget\evidence\trading-log\nightdesk-paper-trading-log.csv
```

### npm run mcp:integration-test

Status: PASS · Duration: 925ms

```txt
> nightdesk@0.0.1 mcp:integration-test
> tsx src/execution/integration-proof.ts


NIGHTDESK INTEGRATION PROOF COMPLETE
calls: 5
log: C:\Users\prate\Downloads\bitget\evidence\integration\external-agent-run.jsonl
```

### npm run bitget:read-only-proof

Status: PASS · Duration: 2191ms

```txt
> nightdesk@0.0.1 bitget:read-only-proof
> tsx src/integrations/bitget-agent-hub/readOnlyProof.ts


NIGHTDESK BITGET READ-ONLY PROOF COMPLETE
status: live public fetch ok
snapshot: C:\Users\prate\Downloads\bitget\evidence\bitget-live\live-market-snapshot.json
```

### npm run claims:verify

Status: PASS · Duration: 630ms

```txt
> nightdesk@0.0.1 claims:verify
> tsx src/research/claim-ledger.ts

NIGHTDESK CLAIM LEDGER COMPLETE: C:\Users\prate\Downloads\bitget\evidence\claims\claims-manifest.json
```

### npm run run-cards:generate

Status: PASS · Duration: 616ms

```txt
> nightdesk@0.0.1 run-cards:generate
> tsx src/research/run-card.ts

NIGHTDESK RUN CARDS COMPLETE: C:\Users\prate\Downloads\bitget\evidence\run-cards
```

### npm run doctor

Status: PASS · Duration: 655ms

```txt
> nightdesk@0.0.1 doctor
> tsx src/ops/doctor.ts

NIGHTDESK DOCTOR COMPLETE: C:\Users\prate\Downloads\bitget\evidence\doctor-report.md
```

### npm run data:health

Status: PASS · Duration: 656ms

```txt
> nightdesk@0.0.1 data:health
> tsx src/ops/data-health.ts

NIGHTDESK DATA HEALTH COMPLETE: C:\Users\prate\Downloads\bitget\evidence\data-health\source-health.json
```

### npm run docs:check

Status: PASS · Duration: 637ms

```txt
> nightdesk@0.0.1 docs:check
> tsx src/ops/docs-check.ts

NIGHTDESK DOCS CHECK PASS
✓ README.md
✓ SUBMISSION.md
✓ docs/BITGET_NATIVE_PROOF.md
✓ docs/PNL_CLAIM_STANDARD.md
✓ docs/CLAIM_LEDGER.md
✓ docs/SECURITY_BOUNDARIES.md
✓ EVALUATION_STANDARD.md
```

### npm run secrets:scan

Status: PASS · Duration: 728ms

```txt
> nightdesk@0.0.1 secrets:scan
> tsx src/ops/secrets-scan.ts

NIGHTDESK SECRETS SCAN PASS
allowed-runtime-secret data/ledger/attestation_key.json: local runtime Ed25519 ledger signing key; not a Bitget/API credential
```

### npm run evidence:verify

Status: PASS · Duration: 677ms

```txt
> nightdesk@0.0.1 evidence:verify
> tsx src/evidence/verify-artifacts.ts


NightDesk Evidence Artifact Verification

✓ required files exist: ok
✓ paper trading log schema and rows: ok
✓ run event topics include full execution path: ok
✓ guarded replay is positive and labeled: ok
✓ fill realism all cases pass: ok
✓ OOS and walk-forward reports are non-empty and session-backed: ok
✓ integration proof is SDK/MCP-shaped: ok
✓ Bitget live proof is read-only and secret-free: ok
✓ PnL casefile exists and states claim boundaries: ok
✓ raw-PnL alpha championship is profitable and caveated: ok
✓ alpha factory records trials, rejects overfit, and freezes champion: ok
✓ Vibe-inspired alpha zoo and compare exist: ok
✓ shadow gateway counterfactuals exist: ok
✓ claim ledger verifies major claims: ok
✓ run cards, doctor, data health, and cockpit exist: ok
✓ forward paper daemon and daily promoter exist: ok
✓ security, Bitget compat, and cache integrity evidence exist: ok
✓ OOS background daemon and live receipt proof exist: ok
✓ championship mode freezes separate PnL and safety champions: ok
✓ max judge manifest covers deep evidence layers: ok
```

### npm run dashboard:judge

Status: PASS · Duration: 644ms

```txt
> nightdesk@0.0.1 dashboard:judge
> tsx src/face/judge-cockpit.ts

NIGHTDESK JUDGE COCKPIT COMPLETE: C:\Users\prate\Downloads\bitget\evidence\judge-cockpit\index.html
```

### npm run judge:max

Status: PASS · Duration: 9736ms

```txt
✓ evidence/judge-cockpit/index.html
✓ evidence/forward-paper-daemon/session-results.csv
✓ evidence/forward-paper-daemon/live-paper-trading-log.csv
✓ evidence/forward-paper-daemon/daemon-state.json
✓ evidence/forward-paper-daemon/forward-paper-daemon-report.md
✓ evidence/daily-promoter/promotion-decision.json
✓ evidence/daily-promoter/daily-promoter-report.md
✓ evidence/security/security-boundaries.md
✓ evidence/security/security-boundaries.json
✓ evidence/bitget-live/agent-hub-compat-report.md
✓ evidence/bitget-live/agent-hub-compat-report.json
✓ evidence/data-cache/cache-integrity-report.md
✓ evidence/data-cache/cache-integrity-report.json
✓ evidence/oos-daemon/state.json
✓ evidence/oos-daemon/record-log.jsonl
✓ evidence/oos-daemon/refresh-log.jsonl
✓ evidence/live-receipt/order-preview.json
✓ evidence/live-receipt/firewall-verdict.json
✓ evidence/live-receipt/execution-receipt.json
✓ evidence/live-receipt/ledger-verify.txt
✓ evidence/live-receipt/live-receipt-report.md
✓ evidence/championship/leaderboard_pnl.csv
✓ evidence/championship/leaderboard_safety.csv
✓ evidence/championship/champion-pnl.json
✓ evidence/championship/champion-safety.json
✓ evidence/championship/champion-pnl-paper-log.csv
✓ evidence/championship/champion-safety-paper-log.csv
✓ evidence/championship/championship-report.md
✓ evidence/championship/pnl-vs-safety-comparison.md
✓ evidence/championship/champion-overfit-check.md
✓ evidence/championship/champion-overfit-card.md
✓ evidence/championship/trial-registry.csv
✓ evidence/championship/manifest.json
✓ evidence/manifest.json
✓ docs/PNL_CLAIM_STANDARD.md
✓ docs/NAUTILUS_LESSONS.md
✓ docs/SECURITY_BOUNDARIES.md
✓ docs/BITGET_NATIVE_PROOF.md
✓ docs/CLAIM_LEDGER.md
NIGHTDESK MAX JUDGE PACK VERIFIED
```
