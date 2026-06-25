# Month 7 Exit Audit — External Developer Beta

Result: PASS (5/5)

| Exit-gate requirement | Status | Detail |
| --- | --- | --- |
| published OpenAPI contract covers every method with capability + protocol version | PASS | 11 methods, version nightdesk.v1 |
| capability-scoped credentials authorize the privileged, deny the under-privileged | PASS | intent:evaluate allowed=true; paper:execute denied=true |
| malicious/revoked agent is rejected at authentication | PASS | bad-token-rejected=true; revoked-rejected=true |
| rate exhaustion is enforced (flooding agent throttled after budget) | PASS | allowed 3/4; 4th retryAfter=997ms |
| external integrator needs no source-level imports (SDK contract only) | PASS | example imports only the published SDK client |

An external developer integrates from the generated OpenAPI contract and the SDK — no source-level
imports. Credentials are capability-scoped; malicious/revoked agents are rejected; flooding is throttled.
Real third-party adoption is the operational milestone this software gate is built for.
