# Trading Gateway Runtime Foundation

Generated: 2026-06-24T16:12:02.210Z
Protocol: nightdesk.v1

| Control | Result |
|---|---:|
| canonicalPolicy | PASS |
| transportParityCorpus | PASS |
| durableIdempotency | PASS |
| keyedExecutionLanes | PASS |
| capabilityScopedAuth | PASS |
| perAgentRateLimit | PASS |
| livenessReadinessStatus | PASS |

Concurrent duplicate executions: 1
Duplicate shared run ID: true
Duplicate replayed persisted result: true
Rate-limit second request allowed: false
Ready before drain: true
Ready after drain: false
Live after drain: true

Reproduce: `npm run gateway:proof`
