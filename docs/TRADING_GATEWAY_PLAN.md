# NightDesk Trading Gateway Plan

Research date: 2026-06-24  
NightDesk scope reviewed: `src/`, `api/`, `sdk/`, `web/`, `test/`, package commands, and current evidence system.

## Executive verdict

NightDesk should not become a generic assistant product. Messaging channels, mobile apps, media stacks,
generic memory systems, and enormous provider catalogs do not improve its Bitget thesis.

The valuable target is an operational control plane that treats agent execution as a long-running,
versioned, authenticated, observable service rather than a collection of scripts. NightDesk already has
stronger trading-specific safety and evidence, but it is materially weaker in runtime coordination:

- no versioned NightDesk control-plane protocol;
- no durable idempotency record at the order boundary;
- no keyed execution lanes to serialize account and symbol mutations;
- no durable task state machine for queued/running/lost/completed work;
- no API throttling or agent-scoped budgets;
- no atomic config reload or config migration framework;
- limited runtime traces and no redacted support bundle;
- duplicated firewall logic in the Vercel endpoint instead of one canonical policy implementation.

The best upgrade is **NightDesk Trading Gateway**: a narrow, typed control plane around the existing
certificate, firewall, gates, execution, ledger, and evidence modules.

## What a mature agent control plane must do well

These patterns are production requirements rather than aspirational architecture.

| Pattern | Required implementation | Why it matters to NightDesk |
|---|---|---|
| Single control plane | Long-lived Gateway owns routing and exposes typed WebSocket/HTTP APIs | One process should own all trade-intent admission and execution state |
| Versioned wire protocol | Typed request/response/event frames, handshake, schema validation, discovery metadata | External trading agents need a stable contract, not internal imports |
| Two-stage execution | Immediate accepted response, streamed events, final response | Long-running research and order workflows need acknowledgement and progress |
| Idempotency | Side-effecting methods require dedupe keys | Retried requests must never place duplicate paper/live orders |
| Command lanes | Priority queues, concurrency limits, timeouts, drain-on-restart | Account/symbol state mutations must be serialized deterministically |
| Runtime health | Liveness/readiness, process-incarnation records, stale-process filtering | Daemons and forward sessions need trustworthy health, not a PID file alone |
| Durable task audits | Detects stale queued/running/lost tasks and missing cleanup | A frozen-champion run must never disappear silently |
| Safe provider retries | Retries transient reads/polls/downloads, not unsafe create operations | Market reads may retry; order creation must use idempotency or fail closed |
| Rate limiting | Scoped auth and control-plane rate limiters | External or malicious agents must not exhaust APIs or flood the firewall |
| Atomic configuration | Hot/restart/hybrid reload plan and doctor-backed migrations | Live policy changes need validation, atomic swap, and an audit trail |
| Extension contracts | Manifest-owned capabilities, trust policy, lazy activation | Broker/data/strategy adapters need explicit capability and ownership contracts |
| Diagnostics | Targeted flags, structured timelines, redaction, support bundles | A judge/operator should diagnose one failed run without exposing credentials |
| Storage budgets | Session high-water marks and orphan cleanup | Evidence growth must be bounded without deleting submitted artifacts |
| Upgrade survival | Clean-install, migration, corrupt-plugin, restart, and published-upgrade E2E tests | A submission tag must reproduce after installation and future changes |
| Explicit trust model | Operator, plugin, workspace, node, and remote-ingress boundaries | NightDesk needs separate agent identity, operator identity, and execution authority |

## NightDesk's current position

NightDesk already has strong domain capabilities:

- signed, expiring market certificates;
- deterministic ALLOW / ALLOW_CAPPED / REJECT enforcement;
- 15 trading risk gates;
- event-sourced order state machine;
- depth, partial-fill, stale-quote, fee, slippage, and adverse-selection modeling;
- guarded/unguarded counterfactual evaluation;
- frozen PnL and safety champions;
- purged walk-forward and overfit evidence;
- append-only signed trading evidence;
- Bitget-style paper logs and Agent Hub/MCP proof.

Do not replace these. Put the production control plane around them.

## Critical findings in NightDesk

### 1. The public firewall duplicates canonical policy

`api/firewall.ts` says it mirrors `src/kernel/firewall.ts` and
`src/kernel/certificate.ts`, but it contains a second implementation. This creates policy drift risk.
The serverless endpoint can pass while the tested canonical kernel changes.

**Fix:** publish one dependency-free policy package or generate a signed policy artifact from the
canonical kernel. Both HTTP and MCP adapters must call the same evaluator. Add a contract test that
runs a corpus through every transport and requires byte-equivalent verdicts.

### 2. Deterministic order IDs are not full idempotency

NightDesk generates deterministic order IDs, which is good, but there is no durable idempotency store
at the external request boundary. Two concurrent retries can still race before either records completion.

**Fix:** persist `(agentId, idempotencyKey, requestHash, runId, status, resultHash)`. Reusing a key with
the same payload returns the original run; reusing it with a different payload is rejected.

### 3. The event bus is in-memory and unsequenced

`RunBus` caches the latest event per topic but has no monotonic sequence, state version, replay cursor,
or durable event journal. A dashboard reconnect can silently miss decisions.

**Fix:** emit `seq`, `stateVersion`, `runId`, `causationId`, and `correlationId`; persist events before
publishing. On a gap, clients request a state snapshot or replay from a cursor.

### 4. No execution serialization boundary

There is no keyed queue/mutex around account, strategy, or symbol mutations. Multiple MCP/HTTP calls
can evaluate against the same balance or exposure snapshot and each appear valid.

**Fix:** use keyed lanes:

```txt
account:<accountId>             serial balance/exposure mutations
account:<accountId>:<symbol>    serial order lifecycle mutations
research:<datasetHash>          bounded parallel research
provider:<providerId>           provider concurrency/rate budget
```

### 5. Health is artifact-oriented rather than runtime-oriented

`doctor` and `data:health` produce useful evidence, but the running daemon lacks a unified liveness,
readiness, backlog, active-run, last-success, and degraded-reason snapshot.

**Fix:** add `/health/live`, `/health/ready`, `/status`, and a signed runtime snapshot. Readiness must
fail if the anchor is unavailable, state is corrupt, execution is draining, or the ledger cannot append.

### 6. Provider failures are not governed consistently

Provider calls do not share a standard timeout, retry, abort, classification, or circuit-breaker policy.

**Fix:** create a provider runtime wrapper. Retry only idempotent reads on 5xx/timeouts/network resets;
never blindly retry order creation. Record attempt count, latency, source timestamp, and fallback mode.

### 7. External-agent authority is not identity-scoped

MCP is read-only and the firewall is safe, but callers do not have durable agent identities,
capability grants, per-agent notional ceilings, or revocation.

**Fix:** issue agent credentials bound to capabilities such as:

```txt
market:read
certificate:issue
intent:evaluate
paper:execute
live:preview
live:execute:dust
evidence:read
```

No model or agent receives `live:execute:dust` by default.

### 8. No durable task lifecycle

Research runs, OOS recording, and forward paper sessions are files/processes rather than one durable
task model. Crash recovery and lost-task detection are therefore fragmented.

**Fix:** persist task states: `queued`, `accepted`, `running`, `degraded`, `completed`, `failed`,
`canceled`, `lost`. Store heartbeats, deadlines, owner process incarnation, cleanup time, and artifact links.

## Ranked adoption backlog

Scoring: impact is specific to winning the Bitget submission; effort is relative engineering cost.

| Rank | Gateway capability | Impact | Effort | Decision |
|---:|---|---:|---:|---|
| 1 | Canonical Trading Gateway with typed protocol | 10 | 8 | Build |
| 2 | Durable idempotency at every side-effect boundary | 10 | 5 | Build |
| 3 | Keyed command lanes with priorities, deadlines, draining | 10 | 6 | Build |
| 4 | Eliminate HTTP/MCP/kernel policy duplication | 10 | 4 | Build immediately |
| 5 | Durable task registry and stale/lost task audit | 9 | 7 | Build |
| 6 | Agent identity, capability grants, and revocation | 9 | 7 | Build |
| 7 | Scoped rate limits and per-agent cost/notional budgets | 9 | 5 | Build |
| 8 | Sequenced event journal plus SSE/WebSocket progress | 9 | 7 | Build |
| 9 | Provider runtime: timeout/retry/abort/circuit breaker | 8 | 5 | Build |
| 10 | Redacted diagnostics and support bundle | 8 | 4 | Build |
| 11 | Liveness/readiness/backlog/runtime health | 8 | 4 | Build |
| 12 | Atomic config snapshots and audited policy reload | 8 | 7 | Build |
| 13 | Config schema versions and doctor migrations | 8 | 6 | Build |
| 14 | Upgrade-survivor clean-install E2E test | 8 | 5 | Build |
| 15 | Broker/data/strategy adapter contracts | 7 | 8 | Build narrowly |
| 16 | Lifecycle hooks for audit and evidence generation | 7 | 5 | Build |
| 17 | Evidence retention/disk budgets | 6 | 4 | Build after submission |
| 18 | Scheduled task run history and retry hints | 6 | 5 | Adapt to OOS daemon |
| 19 | Generic plugin marketplace | 2 | 10 | Reject |
| 20 | Messaging channels/mobile/media/generic memory | 1 | 10 | Reject |

## Target architecture

```txt
External Agent / SDK / MCP / Judge UI
                  |
                  v
       NightDesk Trading Gateway
       - protocol handshake/version
       - agent identity/capabilities
       - schema validation
       - rate and cost budgets
       - idempotency registry
       - accepted/run/final lifecycle
                  |
                  v
        Keyed Execution Lanes
        - account lane
        - symbol lane
        - research lane
                  |
                  v
      Canonical Deterministic Core
 market snapshot -> certificate -> firewall -> 15 gates
                  |
                  v
       Paper / Preview / Live Adapter
                  |
                  v
       Event Journal + Signed Ledger
                  |
       SSE/WS progress, evidence, cockpit
```

The LLM remains outside the trusted execution boundary. It can propose an intent; it cannot mutate
balances, bypass lanes, change policy, or retry a live order directly.

## Proposed wire contract

```ts
interface GatewayRequest<T = unknown> {
  protocolVersion: "nightdesk.v1";
  requestId: string;
  idempotencyKey?: string;
  agentId: string;
  sessionId: string;
  method: string;
  params: T;
  deadlineAt?: string;
}

interface AcceptedResponse {
  requestId: string;
  runId: string;
  status: "accepted";
  stateVersion: number;
}

interface RunEvent<T = unknown> {
  protocolVersion: "nightdesk.v1";
  seq: number;
  stateVersion: number;
  runId: string;
  correlationId: string;
  causationId?: string;
  type: string;
  timestamp: string;
  payload: T;
}
```

Initial methods:

```txt
health.live
health.ready
market.snapshot
certificate.issue
intent.evaluate
paper.execute
live.preview
run.get
run.cancel
run.events
evidence.get
```

`paper.execute`, `live.preview`, and any future live write require an idempotency key. A real live write
also requires a capability grant, certificate, passing gates, dust cap, explicit operator approval, and
the serialized account lane.

## Testing to copy conceptually

The gateway requires the following test taxonomy:

| Suite | Required scenarios |
|---|---|
| Protocol contract | malformed first frame, unsupported version, unknown method, schema mismatch |
| Idempotency | concurrent duplicate, retry after timeout, same key/different payload, restart recovery |
| Queue | FIFO at equal priority, priority ordering, timeout release, cancel, drain/restart, starvation |
| State concurrency | two orders against same balance, two fills on same order, cancel/fill race |
| Event recovery | dropped event, reconnect, cursor replay, snapshot after sequence gap |
| Runtime recovery | process crash mid-order, stale PID reuse, orphan task, ledger append failure |
| Provider policy | transient read retry, permanent failure, aborted request, no unsafe create retry |
| Rate/budget | malicious flood, per-agent limit, global limit, cost ceiling, lockout recovery |
| Config migration | old schema backup/migrate, invalid policy reject, atomic reload rollback |
| Upgrade survivor | install old tagged release, generate state, upgrade current, verify evidence |
| Transport parity | HTTP, MCP, CLI produce identical verdict and reason for the same corpus |
| Diagnostics redaction | support bundle contains run data but never Bitget/Qwen secrets |

## Implementation candidates

Reasonable isolated components:

- transient provider error classification and abort-aware exponential backoff;
- keyed async queue mechanics and lane snapshots;
- sliding-window rate limiter structure;
- process-incarnation health envelope;
- diagnostic flag matching and redaction tests;
- stale/lost task audit logic;
- high-water disk-budget cleanup safeguards.

Do not import large generic modules blindly. Extract the invariant and keep a small NightDesk-owned
implementation.

## What should not be copied

- WhatsApp/Telegram/Slack/channel routing;
- native iOS/Android/macOS nodes;
- media, voice, canvas, browser, and phone-control systems;
- hundreds of model-provider integrations;
- a public plugin marketplace;
- generic long-term conversational memory;
- manager-of-managers agent hierarchies;
- the monorepo's build complexity and thousands of repository-specific checks.

These would increase attack surface and distract from the tokenized-stock thesis without improving the
required paper record, Bitget integration, PnL evidence, or trading safety.

## Implementation sequence

### Phase 0: policy parity

1. Extract canonical certificate/firewall evaluation into a transport-safe package.
2. Make HTTP, MCP, SDK, paper, and live-preview adapters call it.
3. Add a transport-parity corpus test.

### Phase 1: reliable execution boundary

1. Add protocol envelopes and schema validation.
2. Add durable idempotency storage.
3. Add keyed account/symbol execution lanes.
4. Add accepted/progress/final run lifecycle.
5. Add scoped rate limits and notional/cost budgets.

### Phase 2: operations

1. Add durable task registry and heartbeats.
2. Add liveness/readiness/status endpoints.
3. Add structured diagnostic timeline and redacted support bundle.
4. Add provider retry/abort/circuit-breaker wrapper.
5. Stream sequenced events to the Judge Cockpit.

### Phase 3: maintainability

1. Add config schemas, atomic reload, and doctor migrations.
2. Add narrow provider/broker/strategy adapter contracts.
3. Add upgrade-survivor and corrupt-state E2E tests.
4. Add evidence retention and disk budgets.

## Hackathon priority on 2026-06-24

The submission deadline is near, so the highest-value immediate subset is:

1. remove firewall policy duplication;
2. add durable idempotency and serialized execution lanes;
3. expose accepted/run/final lifecycle and runtime status;
4. add API rate limits;
5. show these four controls in the Judge Cockpit and evidence manifest.

That subset directly strengthens runnability, completeness, external integration, and safety without
changing the economic thesis or invalidating the frozen forward record.

## Final recommendation

Do not turn NightDesk into a generic assistant. Turn NightDesk into the **production control plane for
trading agents**.

The strongest final claim becomes:

> NightDesk does not merely score a trade. It accepts authenticated agent intents through a versioned
> control plane, deduplicates retries, serializes account mutations, applies one canonical safety kernel,
> streams a recoverable run record, and commits every decision to signed evidence.

That improvement is more defensible than adding more alpha families, more council roles, or more UI.
