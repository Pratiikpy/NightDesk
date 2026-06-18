# NightDesk — Judge Quicklook (30 seconds)

> **The perp says ALL CLEAR. The real stock says ~17 of 19 are mispriced.**
> NightDesk surfaces that hidden gap, certifies each token, runs a firewall that **ALLOW / CAP / REJECT**s
> every agent trade, then **signs and grades** the outcome. **Bitget created the market; NightDesk makes
> it agent-safe.**

One command verifies everything below: `npm run judge:max` (tests + evidence + manifest).
One screen shows it live: `npm run dashboard:judge` → `evidence/judge-cockpit/index.html`.

## The loop (no human in the middle)
`PERCEIVE` live token + real-NYSE anchor + news + macro → `DECIDE` 7-seat Qwen council (or stand down)
→ `GATE` 15 hard risk gates → `EXECUTE` realistic fills in the BitSim sandbox → `GRADE` at the NYSE open,
signed. The **LLM proposes; deterministic, tested code certifies, gates, executes, signs, grades.**

## The green numbers (current-recording paper evidence — not future alpha)
| Mode | Result |
|---|---|
| **PnL champion** (Alpha Factory, frozen) | **+54.93 USDT** in-sample, 6.33 max DD, from 9,720 candidates / 48,600 trials / 8,444 rejected |
| **Raw-PnL championship** (single session) | `1,000.00 → 1,034.61 USDT` |
| **Safety champion** (separate, same hard invariants) | optimized for risk-adjusted execution, not raw PnL |
| **Guarded paper replay** | `1,000.00 → 1,004.34 USDT`, 38 fills, every unsafe intent blocked |

PnL champion and Safety champion are kept **separate on purpose**: one carries the green-number story,
the other carries the production thesis.

## Bitget-native proof
- Live **read-only** public market data, all 19 pairs — no key needed.
- Real authenticated round-trip: account probe `code 00000`; trade endpoint `40014: read-only key`.
- **Qwen 3.6** council · **Playbook** on-platform backtest · **Agent Hub Skill Hub** `macro-analyst` in the loop.
- MCP tool `evaluate_intent` + SDK → other agents route through the gateway in ~20 lines.

## Forward (out-of-sample) record — accumulating live
Against a **locked** champion, the forward record grows only in wall-clock market time. The Judge Cockpit
shows the live counter (forward sessions, OOS session bank vs target, recorder status, snapshots). It is
**early and never fabricated** — that transparency is the point.

## Security
`secrets-scan: CLEAN` · live trade disabled by default · Bitget key read-only (`40014`) · env-only
credentials · no accidental write path · live path dry-run verified, **no real fill claimed**.

## The rigor (why you can trust the numbers)
We red-teamed our **own** thesis: the convergence-reversion edge is **null — 49.6% corrective, a coin
flip** (`npm run backtest -- --daily`), and we publish it. The ~93% "capture" stat is a shuffle-test
artifact, and we flag it. We also **deflate our own champion for selection bias** — after correcting for
9,720 trials, its Deflated Sharpe is *not yet significant* (`npm run overfit:stats`; Bailey & López de
Prado's Deflated Sharpe / PBO / MinTRL). No look-ahead is possible by construction (a sentinel test
proves it). **215 tests**, every figure replayable from one command.

## Known limitations (disclosed, not buried)
- Forward OOS record is early — it grows over market time; we show the counter, not invented history.
- Live receipt is read-only / dry-run only — the path is real, the fill is not claimed.
- The PnL champion is current-recording evidence, not validated future alpha.
- No third-party production users yet — integration-ready and shown with example agents.

## Track fit (judged together for #1)
**Trading Agent** (the autonomous loop) · **Trading Infrastructure** (firewall + certs + ledger + SDK/MCP
+ open-source sandbox) · **US Stock AI Trading** (real-stock fair-value anchor + the perp-illusion).
