# Final UAT Matrix

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
