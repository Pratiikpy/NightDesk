# NightDesk One-Year Master Plan

Planning assumption: NightDesk has a full twelve-month product-development window. The supplied event
text still lists June 25, 2026 as the submission deadline, so the extension must be confirmed before
public dates are changed. This document plans the product independently of that administrative check.

## North star

Build the best **agentic trading control plane for Bitget tokenized US stocks**:

> NightDesk autonomously perceives market state, researches and validates strategies, selects a frozen
> champion, evaluates every trade through a deterministic safety gateway, executes through realistic
> paper/live adapters, grades every action and abstention, learns from outcomes, and publishes a
> reproducible evidence record.

NightDesk is not merely a safety tool and not merely a profit bot. It is one integrated system:

```txt
market truth + autonomous research + robust alpha + execution safety
+ external-agent infrastructure + signed economic evidence
```

## What “best” must mean

The product is not best because it has the most modules. It is best only if it wins six independent
tests.

| Dimension | One-year proof |
|---|---|
| Thesis depth | Publish a falsifiable tokenized-stock market-structure thesis with positive and null findings |
| Agentic autonomy | Continuous perceive -> decide -> execute -> grade -> learn loop with no manual strategy tuning after freeze |
| Economic quality | Forward guarded and unguarded PnL, realistic fills, attribution, confidence intervals, and failed trials |
| Trading safety | Zero unauthorized executions, zero duplicate orders, fail-closed market data, signed decision chain |
| Infrastructure | Public SDK/MCP/API, stable protocol, independent integrations, documented compatibility |
| Product quality | Reliable hosted cockpit, clean onboarding, incident handling, reproducible one-command evaluation |

## Final product architecture

```txt
Bitget + equity anchors + macro/news/sentiment/on-chain inputs
                            |
                     Perception Fabric
                 normalization + provenance
                            |
                     Market Truth Engine
        true gap + regime + event cause + tradeability state
                            |
              Autonomous Research and Alpha Factory
       strategy DSL -> trials -> Overfit Court -> champions
                            |
                    Agent Decision System
    evidence retrieval -> specialist debate -> intent proposal
                            |
                 NightDesk Trading Gateway
  identity -> schema -> rate budget -> idempotency -> execution lane
                            |
             Certificate -> Firewall -> Hard Risk Gates
                            |
        Paper / Shadow / Preview / Restricted Live Execution
                            |
              Event Journal + Signed Evidence Ledger
                            |
       Outcome Grader -> Memory -> Champion Promoter/Retirer
                            |
                  SDK / MCP / API / Judge Cockpit
```

The LLM can interpret evidence and propose actions. Deterministic code owns arithmetic, limits,
certificates, order state, fills, accounting, promotion criteria, and execution authorization.

## Twelve-month outcome targets

These are targets, not claims. Every achieved metric must link to raw evidence.

### Market and economic evidence

- 200 or more distinct forward market sessions if the available calendar permits.
- Coverage across ordinary, earnings, FOMC, CPI, NFP, holiday, weekend, high-gap, and low-liquidity regimes.
- Frozen champion evaluated on at least 60 genuinely post-freeze sessions before production-grade claims.
- Every trial recorded; no deleted losing strategies.
- Guarded-versus-unguarded counterfactual for every supported baseline agent.
- Full PnL attribution: gross edge, spread, slippage, fees, funding, partial fills, timing, sizing, blocks.
- Fill-model calibration by token and liquidity tier against real observed order books and any available fills.

### Reliability and safety

- Zero unsafe intents allowed in adversarial and property suites.
- Zero duplicate orders under concurrent retry and restart tests.
- Zero tradeable certificates from stale/missing anchor data.
- 99.9% target availability for the hosted read-only gateway after public beta.
- Recovery-point objective: no acknowledged order/evidence event lost.
- Recovery-time target: under five minutes for stateless services; under fifteen minutes for state recovery.
- All write paths identity-scoped, capability-scoped, rate-limited, and idempotent.

### Developer adoption

- Three independent external developers or agents integrated without source-level imports.
- At least two public integration examples: Bitget Agent Hub and generic MCP/SDK agent.
- Stable `nightdesk.v1` contract with compatibility tests.
- Public benchmark with at least ten agent archetypes and reproducible scorecards.
- Installation-to-first-verdict under five minutes on a clean machine.

### Product clarity

- A new user understands the problem and sees a verdict in under sixty seconds.
- Every cockpit number links to its raw artifact and reproduction command.
- Three-minute demo contains one complete real flow, not a repository tour.
- Public status, methodology, limitations, incidents, and changelog pages.

## Core workstreams

### 1. Market data and truth

Build a provenance-first data fabric:

- Bitget spot/rToken ticker, order book, trades, candles, funding, open interest, and account state.
- Real-equity reference with market calendar, official session state, corporate actions, splits, dividends,
  earnings, and source/license metadata.
- Macro calendar and surprise values.
- News and sentiment with publication time, ingestion time, source reliability, and duplicate clustering.
- Optional on-chain/institutional context only where it changes tokenized-stock decisions.
- Point-in-time storage: never overwrite historical observations with revised future knowledge.
- Every value carries `source`, `observedAt`, `effectiveAt`, `receivedAt`, `freshness`, and `quality`.

Deliver a **Truth Graph** rather than one price:

```txt
rToken price
perpetual price
real equity price
official close
market state
corporate-action state
event/news state
liquidity state
tracking-quality state
```

### 2. Research and alpha

Upgrade Alpha Factory into a governed research platform:

- Typed strategy DSL separating signal, filter, sizing, entry, exit, hedge, and risk assumptions.
- Domain strategy families: true-gap fade, perp-illusion, event-conditioned abstention, tracking-quality,
  cross-sectional selection, overnight trend, volatility targeting, adaptive grid, and maker quoting.
- Trial registry with code hash, data cutoff, feature set, parameters, costs, and parent mutation.
- Purged/embargoed cross-validation, rolling walk-forward, leave-session-out, leave-token-out, regime holdout.
- Deflated/penalized performance score accounting for number of trials and profit concentration.
- Parameter stability surfaces, cost/slippage stress, bootstrap intervals, and reality checks.
- Champion, challenger, watch, retired, and rejected registries.
- Pre-registration: freeze champion, configuration, data cutoff, and expected distribution before forwarding.
- Null-result publication. A rejected hypothesis is evidence that the lab is functioning.

Do not optimize only PnL. Maintain separate objective functions:

```txt
Safety Champion       downside, robustness, execution quality
PnL Champion          net forward PnL under non-negotiable hard gates
Capital Champion      return per unit drawdown/exposure
Liquidity Champion    realistic capacity and low implementation shortfall
```

### 3. Agentic intelligence

The agent must do work that fixed-rule quant infrastructure does not:

- Read and reconcile news, macro, sentiment, order-book, and cross-asset evidence.
- Generate falsifiable hypotheses in the strategy DSL.
- Design experiments and request data without changing evaluation folds.
- Debate conflicting explanations through bounded specialist roles.
- Explain uncertainty and abstain when evidence conflicts.
- Review expected-versus-actual results and propose challenger research.
- Write structured lessons to memory, with evidence references and expiry.

Council design:

```txt
Market Structure Analyst
Technical/Flow Analyst
Macro and Event Analyst
Liquidity/Execution Analyst
Portfolio Risk Analyst
Adversarial Reviewer
Research Manager
```

The Portfolio/Execution decision remains deterministic after the council outputs a typed proposal.
Council disagreement, evidence coverage, source consistency, and hallucination checks become explicit
features. Low consensus reduces size or forces abstention.

### 4. Trading gateway and runtime

Implement the production control plane described in `docs/TRADING_GATEWAY_PLAN.md`:

- Versioned `nightdesk.v1` request/response/event protocol.
- Canonical shared policy used by HTTP, MCP, SDK, paper, and live paths.
- Agent identity, capability grants, revocation, and per-agent limits.
- Durable idempotency registry.
- Keyed account/symbol execution queues.
- Accepted/progress/final run lifecycle.
- Durable task registry, heartbeat, stale/lost detection, cancellation, and crash recovery.
- Sequenced event journal with replay cursors and state snapshots.
- Scoped rate limits, cost budgets, and notional budgets.
- Liveness/readiness/status endpoints.
- Atomic configuration reload and doctor-backed migrations.

### 5. Execution realism

Build research-to-paper-to-live parity:

- Canonical order events and state machine across all environments.
- L1/L2 depth consumption, partial fills, queue position approximations, latency, tick/lot rules.
- Maker/taker fees, funding, borrow/short constraints, minimum notionals, and reject codes.
- Stale, empty, one-sided, crossed, locked, and disappearing books.
- Adverse selection and market impact by token/liquidity tier.
- Clock abstraction and deterministic event replay.
- Expected-versus-realized execution report and implementation-shortfall attribution.
- Shadow execution against live books before any real order.

Progression:

```txt
historical deterministic replay
-> live read-only shadow
-> official simulation/paper
-> manual-confirmed dust limit order
-> restricted autonomous micro-capital
-> larger limits only after governance gate
```

No stage is skipped because the calendar is long.

### 6. Safety and security

Create a formal threat model covering:

- malicious or compromised external agent;
- prompt injection through news or market metadata;
- stale/poisoned market data;
- certificate replay/tampering;
- duplicate/racing orders;
- provider compromise or secret leakage;
- strategy poisoning and test-fold leakage;
- dashboard/API authorization bypass;
- dependency/plugin supply-chain compromise;
- denial of service and API-credit exhaustion;
- operator mistakes and configuration drift.

Controls:

- Fail-closed certificates and gates.
- Read-only default; live writes require explicit capability and environment state.
- Dedicated sub-account, no withdrawal permission, exchange-side limits, IP restrictions where possible.
- Secret manager integration, rotation, scanning, and redacted diagnostics.
- Software bill of materials, lockfile policy, dependency pinning, provenance, and signed releases.
- Static analysis, fuzz/property tests, malicious-agent scenarios, ledger tamper tests, and chaos drills.
- Incident response playbook and post-incident review format.
- Independent security review before autonomous capital.

### 7. Evidence and benchmark standard

Turn evidence into a first-class product:

- Immutable run manifest with code/data/config hashes.
- Signed event chain and account reconciliation.
- Bitget-required paper log fields plus certificate, verdict, costs, fill model, and reason.
- Every claim stored with acceptance criteria, artifact links, reproduction command, and boundary.
- NightDeskBench tasks: stale anchor, liquidity trap, news trap, perp illusion, oversize intent,
  certificate replay, duplicate retry, provider outage, execution shock, and overfit strategy.
- Agent scorecard: economic outcome, unsafe actions, abstention quality, robustness, calibration,
  latency, cost, and reproducibility.
- Public dataset cards and contamination statements.
- Reproducible container/fixture mode and optional live-provider mode.

### 8. Product and UX

Build three focused experiences:

1. **Trader Desk:** truth graph, positions, intent decisions, execution, and alerts.
2. **Agent Gateway Console:** API keys/capabilities, request logs, budgets, failures, SDK examples.
3. **Research Lab:** trials, rejected strategies, champions, forward performance, attribution, and reports.

Judge Cockpit remains a fourth, read-only evidence view. It is not the main product.

Required UX states:

- loading, stale, degraded, provider unavailable, market closed, no signal, abstain, blocked, partial fill,
  order rejected, paused, kill switch, incident mode, and recovered;
- every verdict explains evidence, policy, cap, and expiry;
- every chart distinguishes in-sample, validation, and genuinely forward data;
- no green metric without costs, drawdown, and sample size nearby.

### 9. Developer platform and adoption

- TypeScript SDK first; Python SDK second after contract stability.
- MCP server and Agent Hub example.
- OpenAPI/JSON Schema generated from canonical contracts.
- Hosted sandbox with fixture accounts and deterministic scenarios.
- Twenty-line quickstart plus full production integration guide.
- Webhooks/SSE for run and order events.
- Example reckless, cautious, PnL, and malicious agents.
- Public compatibility matrix and semantic-version policy.
- Recruit design partners: agent builders, quant developers, and tokenized-stock traders.
- Publish monthly engineering/research reports with raw reproducible artifacts.

### 10. Business and ecosystem

Do not monetize before product truth. Validate these models during the year:

- open-source gateway core plus hosted operations/evidence service;
- per-agent API plans based on verdict volume and retained evidence;
- enterprise risk-policy and audit deployment;
- benchmark/certification for agent developers;
- Bitget-native integration or incubation partnership.

Never sell “guaranteed alpha.” Sell trustworthy agent execution, evaluation, and evidence.

## Month-by-month plan

## Implementation status

| Milestone | Status | Verified proof |
|---|---|---|
| Month 1 runtime foundation | Complete | `npm run gateway:proof`, transport parity, durable idempotency, keyed lanes, auth/rate limits, runtime status, full `judge:max` |
| Month 2 point-in-time data platform | Complete | `npm run data:month2-audit` passes 11/11 requirements: canonical provenance, immutable raw/normalized partitions, deterministic point-in-time replay, leakage/quarantine enforcement, 2025-2027 exchange calendar, corporate actions, resilient public streaming with REST recovery, live ticker/book receipt, two-source equity consensus across 19/19 pairs, and quantified real-data coverage |
| Month 3 execution engine v2 | Complete | `npm run execution:month3-audit` passes 8/8: deterministic depth-event replay, latency/slippage, limit-safe partial fills, integrated queue position, venue tick/lot/notional rejects, cancel/fill races, implementation shortfall, 19/19 live shadow calibration, and durable account reconciliation/restart recovery |
| Month 4 Alpha Factory v2 | Complete | `npm run alpha:month4-audit` passes 8/8: typed strategy DSL, 58,320 lineage-complete trials, config/code/data/cost hashes, adjacent-session embargo, explicit DSR/PBO limits, 27-point evaluated stability surface, immutable content-addressed freeze, and champion/challenger/watch/retired registry |
| Month 5 agentic research loop | Complete | `npm run agentic:month5-audit` passes 5/5: a research agent that generates grounded strategy-DSL experiments with point-in-time isolation (no held-out access), deterministic rejection of unsafe experiments, bounded grounded council with hallucination control, ablation showing the agentic layer changes decisions vs a fixed policy, and temporally-valid source-linked memory retrieval |
| Month 6 forward champion program | Complete | `npm run forward:month6-audit` passes 5/5: four champion lanes (PnL, safety, capital, liquidity) selected from one trial set under hard invariants, locked champions frozen through the forward window, signed tamper-evident sessions (history cannot be rewritten), exact reconciliation, and automatic WATCH/RETIRE on degraded forward performance |

The status table records implemented and verified work only. Later month sections remain planned scope until
their exit gates pass.

### Month 1: Runtime foundation

Build:

- canonical shared firewall/certificate package;
- transport-parity corpus tests;
- `nightdesk.v1` protocol schemas;
- idempotency registry;
- account/symbol keyed queues;
- API auth and rate limiting;
- runtime liveness/readiness/status.

Exit gate:

- concurrent duplicate requests produce one order/result;
- HTTP, MCP, SDK, and paper paths return identical verdicts;
- restart/drain tests pass;
- unsafe intents allowed remains zero.

### Month 2: Point-in-time data platform

Build:

- normalized event store and provenance schema;
- market calendar and corporate-action handling;
- reliable Bitget streams with reconnect/gap detection;
- equity-anchor redundancy and source-quality scoring;
- raw/normalized immutable dataset partitions;
- data-quality dashboard and quarantine path.

Exit gate:

- historical replay is deterministic;
- missing/stale/contradictory data fails closed;
- point-in-time leakage tests pass;
- data coverage and gaps are quantified.

Verified by `npm run data:month2-audit`, `npm run evidence:verify`, and the full `npm run judge:max:full`
pipeline. The exit audit is generated at `evidence/data-platform/month2-exit-audit.md`.

### Month 3: Execution engine v2

Build:

- depth-aware event replay;
- latency, partial fills, queue position, tick/lot and venue rejects;
- implementation-shortfall reports;
- shadow execution against live order books;
- account reconciliation and crash recovery.

Exit gate:

- no fantasy fills;
- simulation error reported by liquidity tier;
- cancel/fill/race/property tests pass;
- paper account reconciles exactly from events.

Verified by `npm run execution:v2-proof`, `npm run execution:shadow-calibrate`,
`npm run execution:month3-audit`, the 2,000-run execution property suite, and `npm run evidence:verify`.
The live shadow receipt covers all 19 symbols and explicitly classifies symbols without two-sided depth as
untradeable rather than inventing fills.

### Month 4: Alpha Factory v2

Build:

- strategy DSL and experiment registry;
- expanded domain Alpha Zoo;
- purged/embargoed folds and regime holdouts;
- multiple-testing penalty and stability surfaces;
- champion/challenger registry;
- pre-registration and immutable freeze records.

Exit gate:

- every leaderboard row traces to code/data/config hashes;
- losing and rejected trials remain visible;
- no test fold influences selected parameters;
- champion promotion is reproducible.

Verified by `npm run alpha:factory`, an identical rerun that preserved the immutable freeze byte-for-byte,
`npm run alpha:month4-audit`, and `npm run evidence:verify`. The current Deflated Sharpe remains
non-significant and is published as a null finding rather than hidden.

### Month 5: Agentic research loop

Build:

- evidence-retrieval memory;
- bounded specialist council;
- hypothesis and experiment-generation agent;
- hallucination/source-consistency checks;
- structured post-session reflection;
- challenger proposal and human-readable research report.

Exit gate:

- agent generates valid DSL experiments without accessing held-out outcomes;
- deterministic system can reject malformed/unsafe proposals;
- ablation shows whether the agent adds value beyond fixed policies;
- memory retrieval is temporally valid and source-linked.

### Month 6: Forward champion program

Build:

- safety, PnL, capital, and liquidity champion lanes;
- continuous paper daemon;
- expected distribution and daily promoter/retirer;
- guarded/unguarded Shadow Gateway;
- session-bank quality and regime coverage reports.

Exit gate:

- champion remains frozen during forward sessions;
- promoter cannot rewrite history;
- every session is signed, reconciled, and attributable;
- poor champion performance triggers WATCH/RETIRE automatically.

### Month 7: External developer beta

Build:

- hosted sandbox;
- TypeScript SDK, MCP, OpenAPI, webhooks/SSE;
- capability-scoped credentials and usage budgets;
- Agent Hub integration sample;
- integration telemetry and support diagnostics.

Exit gate:

- at least two external users integrate from public docs;
- no source-level imports required;
- malicious-agent and rate-exhaustion tests pass;
- installation-to-first-verdict under five minutes.

### Month 8: Restricted live pilot

Prerequisites:

- independent security review;
- dedicated constrained sub-account;
- exchange-side controls and no withdrawal authority;
- at least 60 post-freeze paper sessions or a documented governance exception;
- calibrated execution model and incident drill.

Build/run:

- shadow-live comparison;
- manual-confirmed dust limit orders;
- restricted autonomous micro-capital only after dust proof;
- real expected-versus-actual fills and PnL attribution;
- kill-switch and rollback drills.

Exit gate:

- no safety or reconciliation exceptions;
- live receipts link to the complete decision chain;
- simulation-vs-live error stays inside declared bands;
- any breach returns system to shadow mode.

### Month 9: NightDeskBench and standards

Build:

- benchmark task definitions and fixtures;
- agent scorecards and confidence intervals;
- adversarial market and protocol scenarios;
- Agent Intent Spec v1 and Token Safety Standard v1;
- third-party agent submission format.

Exit gate:

- independent agents can run benchmark unchanged;
- deterministic replay produces identical scores;
- benchmark separates safety, economic, and reproducibility dimensions;
- benchmark cannot be passed by always-block behavior alone.

### Month 10: Reliability and security hardening

Build:

- durable task registry and event replay recovery;
- chaos/provider outage testing;
- redacted support bundle and structured diagnostics;
- config migrations and upgrade-survivor tests;
- SBOM, signed release, dependency gates, backup/restore and disaster recovery.

Exit gate:

- recovery objectives demonstrated;
- old release upgrades without losing evidence;
- secrets never appear in logs/bundles;
- incident runbook exercised and timed.

### Month 11: Product adoption and final study

Run:

- design-partner cohort;
- independent integration proof;
- final locked comparative study;
- capacity/liquidity analysis;
- usability tests for trader, developer, and judge personas;
- public methodology and limitation review.

Freeze:

- thesis, protocol, benchmark, champions, evaluation plan, and submission claim boundaries.

Exit gate:

- no major unsupported claim;
- every critical workflow has external evidence;
- product metrics and user feedback are published honestly;
- final evaluation no longer changes strategy parameters.

### Month 12: Submission-grade release

Build/package:

- clean public repository and tagged reproducible release;
- hosted demo with public fixture mode;
- final evidence manifest and signed casefile;
- three-minute demo video and backup recording;
- submission page, project description, integration guide, methodology, and security report;
- fresh-machine, offline, degraded, malicious-agent, and upgrade UAT.

Exit gate:

```txt
clean clone succeeds
one-command verification succeeds
paper/live records validate
external integration succeeds
unsafe agent attacks fail
economic claims reproduce
cockpit is understandable in 30 seconds
all public links work without login
```

## Quarterly stage gates

### End of Q1: trustworthy runtime

No alpha expansion matters unless the canonical gateway, data provenance, and execution engine are
correct. Q1 ends only when retries cannot duplicate orders and replay reproduces account state.

### End of Q2: trustworthy research

No profitability claim advances unless trials are registered, champions are frozen, and forward paper
sessions accumulate without parameter changes.

### End of Q3: trustworthy external use

No infrastructure claim advances until independent agents integrate and the restricted live pilot proves
the same safety path governs real orders.

### End of Q4: trustworthy product

No final release advances until external users, clean machines, incident drills, benchmark reproduction,
and public evidence all succeed.

## Evaluation program

Every month publish a scorecard with:

```txt
forward sessions and regime coverage
champion status and data cutoff
net PnL and confidence interval
max drawdown and worst session
guarded-vs-unguarded delta
blocked losses and false-block cost
fill-model error and implementation shortfall
unsafe intents allowed
duplicate orders
gateway uptime and p95 verdict latency
external integrations and successful API calls
known limitations and incidents
```

Never compare agents on raw PnL without equal timestamps, data, costs, fill semantics, initial capital,
sizing constraints, and exit rules.

## Team shape

For a five-person maximum team:

| Role | Ownership |
|---|---|
| Product/research lead | thesis, evaluation, claims, Bitget relationship, submission |
| Trading systems engineer | event model, execution, reconciliation, venue adapter |
| Agent/ML engineer | perception, council, memory, research agent, Qwen integration |
| Platform/security engineer | gateway, identity, queues, reliability, security, deployment |
| Frontend/developer-experience lead | desk, lab, gateway console, docs, SDK, demo |

If solo, preserve the same ownership boundaries as modules and work sequentially. Do not attempt all
workstreams simultaneously.

## Repository evolution

Target structure:

```txt
packages/
  contracts/          versioned schemas and generated clients
  kernel/             certificate, firewall, gates
  gateway/            identity, idempotency, queues, tasks, API
  market-data/        adapters, provenance, storage
  execution/          order model, paper/shadow/live adapters
  research/           DSL, trials, Overfit Court, champions
  agent/              perception, council, memory, promoter
  evidence/           ledger, manifests, claims, benchmark
  sdk-ts/
  sdk-python/
apps/
  trader-desk/
  research-lab/
  gateway-console/
  judge-cockpit/
```

Do not migrate into a monorepo until Month 1 contracts are stable and the migration has a concrete
benefit. Repository shape is not product progress.

## Things deliberately excluded

- Training a foundation model. Use Qwen and invest in data, tools, evaluation, and constrained prompts.
- Deep reinforcement learning before sufficient point-in-time data and trustworthy simulation exist.
- Hundreds of generic indicators or connectors.
- Generic crypto exchange support before Bitget tokenized-stock quality is excellent.
- Mobile/native applications before the web product and API have external users.
- A public plugin marketplace before adapter contracts and supply-chain controls mature.
- More council roles without ablation evidence.
- Same-sample PnL optimization presented as future alpha.
- Large live capital before restricted-pilot gates pass.

## Winning narrative after one year

```txt
Tokenized US stocks trade when their underlying market is closed, so an autonomous agent can mistake
a synthetic-market movement for real equity information.

NightDesk builds a point-in-time market truth graph, uses an autonomous research agent to generate and
reject strategies, freezes robust champions before forward evaluation, and routes every intent through
a deterministic, signed trading gateway.

The same system runs historical replay, paper, shadow, and restricted live execution. Other agents
integrate through SDK, MCP, or API. Every trade, block, abstention, fill, balance change, and claim is
reproducible from signed evidence.

NightDesk is not asking judges to trust an AI trading story. It gives them the protocol, benchmark,
forward record, and receipts to verify it.
```

## Final strategic rule

One year should increase **evidence density**, not feature count.

The priority order remains:

```txt
correct market truth
-> correct execution semantics
-> correct safety boundary
-> honest forward economic evidence
-> autonomous research advantage
-> independent developer adoption
-> exceptional presentation
```

If a feature does not improve one of those seven outcomes, it is not part of the best-product plan.
