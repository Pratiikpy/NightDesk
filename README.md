# NightDesk Alpha Gateway — a complete autonomous trading loop + safety gateway for Bitget tokenized US stocks

> **NightDesk is a complete autonomous trading loop for Bitget tokenized US stocks — no human in the
> middle.** It perceives (live token + real-NYSE prices, news, macro), a **Qwen multi-role council**
> decides trade or stand-down, **15 hard risk gates** enforce discipline, **BitSim** executes realistic
> fills, and every decision is graded at the NYSE open and **Ed25519-signed**. Traditional quant can't
> do this.
>
> The edge is structural: tokenized stocks trade 24/7, but the real stock only prices during NYSE
> hours, and the Bitget stock perp — a blended issuer index — co-moves with the token and **hides the
> off-hours dislocation**. NightDesk anchors each token to the real-stock anchor (the latest official
> NYSE print) and **exposes the true gap the perp hides** (live: ~17 of 19 tokens dislocated vs the
> perp's ~0), then fades only what it can cleanly capture **behind a certificate firewall that blocks
> any unsafe agent trade** before it executes. An autonomous **Alpha Factory** searches 9,720
> strategies through an Overfit Court and freezes a champion (**+54.93 USDT in-sample**, reported
> honestly — not a future-alpha claim). A complete loop; the foundational safety layer other
> tokenized-stock agents pass through; every number replayable.

Bitget AI Base Camp Hackathon S1 — **Trading Infrastructure** (safety & fair-value layer for
tokenized US stocks). See `PROJECT.md`, `SUBMISSION.md`, `EVALUATION_STANDARD.md`,
`docs/CLAIM_LEDGER.md`, and `verification-log.md`.

## Judge path — fast core (~2 minutes)

```bash
npm install
npm run build      # typecheck (tsc --noEmit)
npm test           # 205 tests + property tests, network-free
npm run judge      # tests + signed-ledger / firewall / gauntlet repro pack -> "JUDGE PACK VERIFIED"
npm run judge:max  # tests + evidence-artifact checks + complete evidence manifest
npm run dashboard  # the landing page + live desk at http://localhost:8787
```

### Deeper evidence (optional — several of these take 1–3 minutes each)

```bash
npm run paper-session        # Bitget-style paper trading log (trades, blocks, balances, ledger hash)
npm run paper-replay         # recorded-day guarded replay -> realized positive paper PnL (~2 min)
npm run alpha:championship   # raw-PnL championship over the recorded sessions
npm run alpha:factory        # Alpha Factory + Overfit Court + frozen champion (several minutes)
npm run live:trade-proof     # REAL authenticated Bitget round-trip (read-only key, zero funds)
npm run skillhub:proof       # NightDesk consuming real Bitget Agent Hub Skill Hub perception
npm run bitget:read-only-proof # live public Bitget proof, no credentials
npm run shadow-gateway       # actual-vs-guarded counterfactual reports
npm run oos:report           # multi-session OOS study over data/snapshots/*.jsonl
npm run dashboard:judge      # static Judge Cockpit at evidence/judge-cockpit/index.html
npm run final:verify         # full UAT audit (build, tests, redteam, tamper, docs, secrets)
npm run judge:max:full       # full regeneration incl. Alpha Factory (slowest)
```

The submission evidence lives in `evidence/`:

- `evidence/judge-run.json` — machine-readable judge summary with checks, scorecard, ledger proof,
  and gauntlet summary.
- `evidence/api-call-log.jsonl` — usage-record style log for SDK, HTTP, MCP, and kernel firewall
  calls.
- `evidence/trading-log/nightdesk-paper-trading-log.csv` — paper trading record with timestamp,
  asset, direction, price, quantity, notional, balance change, certificate id, verdict, policy, and
  ledger hash.
- `evidence/trading-log/run-summary.md` — 19-token paper session summary: allowed/capped/rejected,
  fills, blocked intents, starting/ending balance, and ledger verification.
- `evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv` — longer recorded-day
  replay with realized paper entries/exits. Current run: 1,000.00 -> 1,004.34 USDT, 38 fills, 16,883
  blocked unsafe/non-executable intents. The threshold search is reported in
  `evidence/trading-log/guarded-replay/threshold-search.json`; this is execution evidence, not an
  out-of-sample alpha claim.
- `evidence/agent-arena-v2/` — seven external-agent policies, each exporting its own Bitget-style
  paper trading CSV plus a summary report. This is integration/benchmark evidence, not the main
  alpha claim.
- `evidence/alpha-championship/` — raw-PnL search over recorded sessions. Current single-session
  champion: 1,000.00 -> 1,034.61 USDT on the 2026-06-17 recording; the global same-config replay
  totals +54.93 USDT across the available recordings. This is labeled as current-recording
  championship evidence, not guaranteed future alpha.
- `evidence/championship/` — explicit two-champion mode: `leaderboard_pnl.csv`,
  `leaderboard_safety.csv`, frozen PnL Champion, frozen Safety Champion, both paper logs, and
  `champion-overfit-check.md`. This protects the green-number story without weakening the safety
  thesis.
- `evidence/alpha-factory/` — autonomous Alpha Factory evidence: 9,720 candidate strategies,
  48,600 recorded trials, 8,444 rejected overfit/fragile configs, walk-forward leaderboard, frozen
  champion, expected-vs-actual paper log, masked-eval note, and agent benchmark standard. Current
  frozen champion: +54.93 USDT total on the recorded sessions with 6.33 USDT max drawdown — this is
  in-sample execution-quality evidence (proof the search/freeze loop works), **not** a future-alpha
  claim; see the honest null edge-test below.
- `evidence/alpha-factory/alpha-zoo-catalog.csv` and `strategy-compare.csv` — the NightDesk
  Alpha Zoo and head-to-head survivor comparison, scoped to Bitget tokenized-stock gaps.
- `evidence/shadow-gateway/` — Shadow Account-style counterfactuals: actual vs guarded, missed
  profit, blocked loss, and rule-break reports for external-agent policies.
- `evidence/claims/` — claim ledger mapping every major project claim to acceptance criteria and
  evidence files.
- `evidence/run-cards/` — one-card summaries for paper session, Alpha Factory, raw-PnL
  championship, guarded replay, Bitget smoke, and judge max.
- `evidence/doctor-report.md` and `evidence/data-health/source-health.md` — one-command operational
  health checks: provider/environment posture and a source-health matrix.
- `evidence/judge-cockpit/index.html` — static Judge Cockpit summarizing alpha, safety, doctor, and
  data-health state.
- `evidence/research/` — research-node output with train/test signal-stability selection and an
  explicit walk-forward caveat.
- `evidence/oos/` — multi-session replay report over every available `data/snapshots/*.jsonl`.
- `evidence/oos/session-bank/` — judge-facing OOS session cards, ledgers, quality scoreboard, and
  target progress toward 10/20/50 sessions.
- `evidence/walkforward/` — leave-one-session-out PnL, cost sweep, and regime summary.
- `evidence/fill-model/` — fill realism report covering empty books, one-sided books, crossed books,
  wide spreads, partial fills, stale quotes, and slippage sweep.
- `evidence/integration/` — SDK/MCP-style external-agent call logs and sample input/output.
- `evidence/bitget-live/` — public Bitget read-only ticker/orderbook proof; no credentials or
  trading permission required.
- `evidence/max-judge-manifest.json` — manifest generated by `npm run judge:max`, confirming the
  full evidence pack exists. `npm run judge:max:full` regenerates the full stack before writing the
  same manifest.
- `FINAL_VERIFICATION.md` and `FINAL_UAT_MATRIX.md` — final pre-submission audit results generated
  by `npm run final:verify`, including environment, command status, blockers, and known limitations.
- `evidence/scenario-uat/scenario-uat-report.md` — scenario test report for actual usage modes:
  fresh judge, paper-log judge, external agent, malicious agent, PnL-only judge, quant judge,
  Bitget-native judge, ops/security review, cockpit demo, offline mode, and OOS daemon.
- `evidence/paper-log-verify.json`, `evidence/ledger-tamper-test.json`, `evidence/gates/`,
  and `evidence/redteam/` — hostile verification artifacts for Bitget paper-log schema,
  tamper-evident ledger behavior, 15-gate coverage, and adversarial intent handling.
- `evidence/sample-inputs/` and `evidence/sample-outputs/` — concrete trade intents, MCP call input,
  firewall verdicts, and a signed certificate.

## Integrate NightDesk in 20 lines

Run the dashboard/API:

```bash
npm run dashboard
```

Then route an external agent's trade intent through the firewall:

```ts
import { NightDeskClient } from "./sdk/nightdesk-client";

const nd = new NightDeskClient("http://localhost:8787");
const intent = { ticker: "NVDA", side: "buy", sizeUsd: 50 } as const;
const verdict = await nd.evaluateIntent(intent);

if (verdict.verdict === "REJECT") throw new Error(verdict.reason);
const sizeUsd = nd.allowedSize(intent, verdict);
// Place the Bitget order with sizeUsd, and only sizeUsd.
```

Runnable example:

```bash
npm run dashboard
npx tsx sdk/examples/external-agent.ts
```

The same enforcement surface is available as MCP tool `evaluate_intent` via `npm run mcp`, so Claude,
Cursor, Codex, or an Agent Hub-style trading agent can ask NightDesk before placing a tokenized-stock
order.

## Quick start

```bash
npm install
npm run build      # typecheck (tsc --noEmit)
npm test           # full unit suite (fair value, BitSim, gates, perception, council, orchestrator, alerts)

npm run demo              # ⭐ 60-second guided tour of the whole loop
npm run status            # live premium/depeg table for all 19 basis pairs
npm run events            # gap-causality risk desk (true gap, cause, action per token)
npm run flags             # tokenized-stock quality board (A–D reliability grade)
npm run record            # persistent recorder → data/snapshots/<day>.jsonl (the evidence base)
npm run simulate [file]   # full NightDesk night → graded scorecard (live collect, or replay a file)
npm run paper-session     # Bitget-style paper trading log: trades, blocks, balances, ledger hash
npm run paper-replay      # optimized guarded replay over data/snapshots/2026-06-15.jsonl
npm run arena:v2          # external-agent benchmark pack: 7 policies, CSV/JSONL logs, summary
npm run research:node     # train/test signal-stability report + guarded replay refresh
npm run alpha:championship # raw-PnL championship: candidates, session bests, paper logs
npm run championship:search # PnL-vs-Safety two-champion championship mode
npm run alpha:factory     # autonomous Alpha Factory + Overfit Court + frozen champion
npm run alpha:zoo         # Alpha Zoo + strategy compare
npm run shadow-gateway    # actual vs guarded counterfactuals
npm run claims:verify     # claim ledger with acceptance criteria
npm run run-card          # run cards for judge artifacts
npm run doctor            # provider/env/security posture report
npm run data:health       # source health matrix
npm run dashboard:judge   # static Judge Cockpit HTML
npm run oos:report        # multi-session OOS study across recorded sessions
npm run oos:session-bank  # OOS Session Bank cards, ledgers, and quality report
npm run pnl:walkforward   # leave-one-session-out PnL, cost sweep, regime summary
npm run fill:stress       # fill realism report: partial/stale/crossed/wide/empty cases
npm run external:proof    # SDK/MCP-style external-agent integration evidence
npm run bitget:read-only-proof # live public Bitget read-only smoke proof
npm run export:trading-log # alias for paper-session; regenerates evidence/trading-log/
npm run external-agent-demo # external-agent paper path through the same firewall/execution log
npm run ablation [file]   # does event-aware abstention beat trade-every-signal?
npm run arena [file]      # agent benchmark: naive/perp-trust/news-blind/random vs NightDesk (we lose less)
npm run gauntlet [file]   # reckless agents unguarded vs firewall-guarded (the firewall makes them lose less)
npm run stress [file]     # stress lab: liquidity drop / stale anchor / price shock vs the firewall
npm run certify           # signed per-token certification (fair/mispriced/news/issuer + agent policy)
npm run firewall          # live proof-carrying trade-intent enforcement (no valid certificate → REJECT)
npm run judge             # ⭐ one-command repro pack: tests + certify + firewall + gauntlet + verify
npm run judge:max         # ⭐ fast max verifier: tests + artifact checks + complete manifest
npm run judge:max:full    # ⭐ full evidence regeneration including Alpha Championship + Alpha Factory
npm run evidence          # submission evidence pack: judge JSON, API call log, sample inputs/outputs
npm run verify            # re-verify the signed audit ledger (Ed25519, tamper-evident)
npm run dashboard         # public PegWatch dashboard at http://localhost:8787
npm run mcp               # expose the risk desk as MCP tools (Claude / Cursor / Agent Hub)
npm run paper-log:verify  # schema/balance/verdict validation for the Bitget-style paper log
npm run ledger:tamper-test # proves signed ledgers fail on mutation/deletion/reorder/signature swap
npm run malicious-agent:test # external-agent abuse proof: reject unsafe, cap valid oversized intents
npm run redteam           # malformed/hostile intent suite
npm run gates:coverage    # pass/fail coverage report for all 15 gates
npm run walkforward:purged # purged walk-forward split report
npm run oos:status        # background OOS daemon state
npm run final:verify      # final pre-submission UAT matrix + verification report
npm run scenario:verify   # scenario-level UAT across real judge/user personas
```

Node 18+ (native fetch). Market data needs no key. The LLM council uses Qwen via the hackathon
proxy (`.env`); the offline simulator uses a deterministic council so it runs with no key/cost.

## Architecture (perception → decision → execution → risk → grade)

| Layer | Module | What it does |
|---|---|---|
| **PegWatch** | `src/pegwatch/` | Fair value vs the real-stock anchor plus rToken/perp/Ondo basis checks, depeg classification (fee-net), and sValue-adjusted 3-price triangulation. Pure math in `fairvalue.ts`, snapshot builder in `collect.ts`. |
| **Recorder** | `src/recorder/` | Polls the universe, appends timestamped JSONL snapshots (quotes + book-when-present). The replayable evidence base. |
| **BitSim** | `src/bitsim/` | Open-source fill sandbox: **quote-first** fills for rTokens (intermittent books), **depth-aware** for perps/Ondo; accounts, PnL, fees, funding. Fills the read-only-execution gap. |
| **Execution Evidence** | `src/execution/` | NightDesk-native event topics, lifecycle states, an enforced order state machine, deterministic order IDs, risk denial codes, modeled latency/slippage, paper-session exporter, guarded replay, arena v2, research node, and max judge manifest. |
| **Alpha Factory** | `src/research/alpha-championship.ts`, `src/research/alpha-factory.ts`, `src/research/championship/` | Raw-PnL championship, two-champion Championship Mode, trial registry, Overfit Court, walk-forward leaderboard, frozen champion, expected-vs-actual paper log, masked eval note, and benchmark standard. |
| **Alpha Zoo + Shadow Gateway** | `src/research/alpha-zoo.ts`, `src/research/shadow-gateway.ts` | Tokenized-stock Alpha Zoo, strategy compare, and actual-vs-guarded counterfactuals. |
| **Claim/Run Evidence** | `src/research/claim-ledger.ts`, `src/research/run-card.ts` | Claim ledger and run cards so judges can map each claim to acceptance criteria and reproduction artifacts. |
| **Ops + Judge Cockpit** | `src/ops/`, `src/face/judge-cockpit.ts` | Doctor report, data-source health matrix, and a static Judge Cockpit. |
| **Evaluation Standard** | `src/research/`, `EVALUATION_STANDARD.md`, `docs/PNL_CLAIM_STANDARD.md` | OOS session study, walk-forward PnL, cost/regime reports, fill realism stress, and explicit claim boundaries. |
| **Perception** | `src/perception/` | EventCard schema + the deterministic basis-event generator + provider interface + numeric grounding. |
| **Council** | `src/council/`, `src/llm/` | Bull/bear/risk-supervisor debate on qwen3.6-plus (pluggable provider; mock for tests) → TradeProposal or NO_TRADE, supervisor veto. |
| **Gates** | `src/gates/` | 15 hard risk gates (pre-trade + live), every evaluation logged. |
| **Orchestrator** | `src/orchestrator/` | NYSE session state machine + the full simulated night (perception→council→gates→BitSim→grade). |
| **Ledger** | `src/ledger/` | Append-only cycle records + scorecard aggregation (hit rate, convergence capture, sim PnL, gate blocks). |
| **Safety Kernel** | `src/kernel/` | Signed, expiring token certificates + proof-carrying trade-intent firewall (`ALLOW`, `ALLOW_CAPPED`, `REJECT`). |
| **MCP + SDK** | `src/mcp/`, `sdk/` | Agent-facing integration surfaces: `evaluate_intent`, `certify_token`, `score_universe`, HTTP firewall client, and runnable external-agent example. |
| **Face** | `src/face/` | Public dashboard (zero-dep server) + alert-bot formatter (Telegram/X, dry-run default). |
| **Playbook** | `playbook/raapl-convergence/` | Deterministic convergence strategy for Bitget Playbook — on-platform backtest evidence (validated by the official `getagent` validator). |

`config/universe.json` is the single source of truth (live-verified): 19 basis pairs, 7 spot-only
rTokens, 2 perp-only, 10 Ondo tokens. No symbols are hardcoded anywhere else.

## Why BitSim splits from Playbook
The LLM council can't be backtested (LLM strategies are live-only on Playbook). So evidence comes
from two engines: **Playbook** = deterministic strategy, backtested + published on Bitget;
**BitSim** = the live sandbox the LLM loop executes through. Complementary, not redundant.

## Verified data traps (see `verification-log.md`)
- rToken ticker `usdtVolume` is garbage — never used.
- rToken L2 books are intermittent (~half live at a time); ticker quote is the always-present
  signal. BitSim is quote-first for rTokens, depth-aware for perps/Ondo.
- Ondo tokens are total-return (price = underlying × sValue) — the Ondo leg passes through an sValue
  adjustment hook before comparison so dividends/splits aren't misread as depegs (v0 multiplier = 1.0;
  real per-ticker multipliers from the dividend/split calendar are a documented, deferred step — never
  faked). The Ondo leg is a secondary cross-check; the primary anchor is the real-stock NYSE print.
- Premiums below the ~0.32% round-trip fee floor are flagged not-tradeable (fee-edge gate).
- Weekend: perps trade with real volume (tradeable); rToken spot is quote-only (measure-only).

## Testing & evidence
- `npm test` — unit suite across every pure module (fills, account PnL, gates, sValue, council
  parsing, session phases, a full graded simulation).
- `npm run simulate` — produces a graded scorecard + `data/ledger/<day>.jsonl` (replayable).
- `npm run paper-session` — produces the paper trading record required by the hackathon checklist:
  CSV/JSONL rows for executed trades and blocked intents, account snapshots, block reasons, and a
  signed run hash under `evidence/trading-log/`.
- `npm run paper-replay` — replays the recorded 2026-06-15 session, performs a deterministic
  threshold search over safety-constrained long-only policies, closes positions at the final
  snapshot, and exports a positive realized paper log under `evidence/trading-log/guarded-replay/`.
- `npm run arena:v2` — runs seven external-agent policies through the paper evidence exporter and
  writes per-agent CSV/JSONL logs under `evidence/agent-arena-v2/`.
- `npm run research:node` — writes `evidence/research/leaderboard.json`,
  `evidence/research/best-config.json`, and `evidence/research/walk-forward-report.md`.
- `npm run alpha:championship` — runs the raw-PnL strategy championship and exports champion paper
  logs under `evidence/alpha-championship/`.
- `npm run championship:search` — runs the explicit PnL-vs-Safety Championship Mode and exports
  `leaderboard_pnl.csv`, `leaderboard_safety.csv`, frozen champions, paper logs, and overfit checks
  under `evidence/championship/`.
- `npm run oos:session-bank` — writes judge-facing session cards and a session-quality report under
  `evidence/oos/session-bank/`.
- `npm run alpha:factory` — runs the autonomous Alpha Factory: searches candidates, records trials,
  rejects fragile configs, freezes a champion, emits expected-vs-actual evidence, and writes
  `evidence/alpha-factory/`.
- `npm run alpha:zoo` — writes the NightDesk Alpha Zoo and head-to-head strategy comparison.
- `npm run shadow-gateway` — writes actual-vs-guarded counterfactual reports, missed-profit, and
  blocked-loss files.
- `npm run claims:verify` and `npm run run-card` — write claim-ledger and run-card artifacts.
- `npm run doctor`, `npm run data:health`, and `npm run dashboard:judge` — write operational
  readiness and static judge cockpit artifacts.
- `npm run judge:max` — verifies the full judge-visible pack quickly: tests, evidence artifact
  checks, and max manifest.
- `npm run judge:max:full` — regenerates the full pack end-to-end, including Alpha Championship and
  Alpha Factory. This is the no-compromise audit path and can take materially longer than 5 minutes.
- `EVALUATION_STANDARD.md` — defines what NightDesk claims and does not claim: safety-gateway
  performance, reproducibility, cost/fill realism, and honest alpha boundaries.
- `python <skill>/scripts/validate.py playbook/raapl-convergence` — validates the Playbook package.

> Note on the short-horizon sim: a few-second live "night" shows the loop is mechanically correct
> and costs are honestly modeled (every round-trip pays the spread), not the strategy edge — the
> convergence it trades (the rToken back to its real-stock anchor) resolves at the **NYSE open**, so
> it needs a recording that spans off-hours → open. Run the recorder across an open, then `simulate`
> the file.

## Validity, look-ahead & contamination

The single biggest threat to any LLM trading backtest is **look-ahead bias / pre-training
contamination** — a model "remembering" the price path of the period it is tested on. NightDesk is
structurally immune, and we make that explicit:

- **The edge is a deterministic cross-instrument basis, not LLM price prediction.** The signal is
  the live fair-value gap (`fairvalue.ts`, pure math). The LLM council only receives *real-time
  numeric state* and emits a *qualitative JSON verdict* — it never forecasts a chart it could have
  memorised, so there is no path for future prices to leak into the decision.
- **Cognitive/execution separation:** all sizing, stops, fills, fees and grading are deterministic,
  type-safe code; the LLM is qualitative-only.
- **Honest backtest controls (reproducible via `npm run backtest`):** survivorship-free basis test
  (non-converging positions are time-stopped / marked-to-end and counted as losses), a **random-entry
  baseline** and a **shuffle test** (we *report* when a metric is a distributional artifact rather
  than an edge — e.g. the convergence-capture rate is), an out-of-sample split, and a cost sweep.
- **Look-ahead sentinel + causal signals** (`test/lookahead.test.ts`): corrupting all data after a
  temporal probe must not change any pre-probe signal value (asserted to 1e-9).
- **Deterministic, network-free test suite:** every unit test is pure and makes no network calls —
  run it with sockets disabled to confirm offline reproducibility.

What we *don't* claim: **we do not claim a convergence-profit edge.** We built a look-ahead-safe test
of our own thesis — does a dislocated rToken revert toward the real stock next session? — and it
comes back **null at the daily horizon** (49.6% corrective, a coin flip; `npm run backtest -- --daily`,
line K). The convergence-capture % is a distributional artifact (shuffle control), and a live
100%-capture paper session still *lost* (convergence ≠ P&L). What NightDesk *is*: an honest **risk &
measurement desk** — it shows the true dislocation the perp hides, stands down on news/macro, fades
only what it can cleanly capture (long-only), and imposes hard risk gates that **demonstrably avoid
losses** (the trades they block lose on average). The null edge-test is itself a receipt of the rigor.
Honesty over hype — every number replayable.
