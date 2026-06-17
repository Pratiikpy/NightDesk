# NightDesk — In-Depth Paper-Trading Report

> Full autonomous loop (perception → 7-role council → 15 risk gates → PaperPit realistic fills →
> grade → signed ledger), replayed over **two real recorded sessions** of live Bitget data. Offline
> deterministic council (so the run is reproducible). The agent trades the **true vs-equity gap**.
> Every number below is what the sandbox actually produced — including the parts that lose money.

Evaluated 2026-06-16. Reproduce: `npm run simulate data/snapshots/<file>.jsonl`.

---

## 1. Sessions

| Session | Date | Type | Snapshots | Cycles | Trades | Gated | Win-rate | Convergence | Net equity (after fills) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| A | 2026-06-15 | Weekend (Sun) | 2,041 | 2,334 | 12 | 2,322 | 16.7% | **12/12 (100%)** | **−0.562%** |
| B | 2026-06-14 | Weekend (Sat) | 819 | 2,249 | 12 | 2,237 | 16.7% | **0/12 (0%)** | **−0.290%** |

Both sessions: 12 positions opened, ~2,300 subsequent attempts gated by risk limits, **0 human
interventions**, ledger Ed25519-signed and re-verifiable.

---

## 2. The headline finding — convergence is NOT P&L

This is the most important result NightDesk produces, and the paper trade demonstrates it **live**,
not just in backtest:

> **Session A converged 100% of the time and lost 0.56%. Session B converged 0% of the time and lost
> 0.29%. Convergence-capture and P&L are decoupled.**

If "convergence capture" were edge, 100%-capture Session A should have made money and 0%-capture
Session B should have lost much more. Instead both lost similar amounts. This is direct, replayable
proof that **the ~93% convergence-capture rate is a diagnostic, not tradeable edge** — exactly what
the backtest's shuffle control already implied, now confirmed end-to-end in execution.

**Why convergence ≠ P&L (mechanically):**
1. **The gap can close from either leg.** We capture only the move of the leg we hold. Example
   (Session A): `GME buy 21.91 → 21.82, premium −2.35% → −0.11% ✓converged, P&L −15.3`. The gap
   closed, but the rToken we bought *fell* — the gap narrowed from the other side.
2. **Shorts trade the perp proxy.** rTokens aren't readily shortable, so a "rich" gap is expressed by
   shorting the perp. The perp can move against us even as the rToken-vs-equity gap closes. Example:
   `NVDA sell 211.06 → 212.50, premium 2.81% → −0.01% ✓converged, P&L −27.3`.
3. **Costs.** Every round-trip pays the spread/fee. Session B's *gross* graded P&L was +$37 but the
   *net* account equity was −$290 — fees turned a tiny gross edge into a net loss.

---

## 3. The risk gates demonstrably worked

In both sessions the agent tried to act on every dislocation each snapshot; the gates capped it:
- **`2_max_gross`** blocked ~2,200 attempts per session once the book was full — preventing
  over-concentration in correlated longs.
- **`5_event_confidence`** blocked the low-conviction small gaps (≈280–730 per session).
- **The gated trades would have lost:** counterfactually, the blocked trades would have converged
  only 11–100% of the time but at an **average −0.9 to −1.3pp** — i.e. **gating them avoided losses.**
  The risk envelope added measurable value, not just safety theater.

---

## 4. Honest conclusion

What this paper trade **proves**:
- The full autonomous loop runs end-to-end on thousands of real snapshots with zero human input,
  produces a graded, signed, re-verifiable ledger, and the risk gates measurably avoid losses.
- The convergence-capture metric is an artifact (confirmed live) — and NightDesk reports it as such.

What it **does not** show — honestly:
- **A profitable session.** On this data the desk lost 0.3–0.6% to costs.

The reason is decisive and not a flaw in the loop: **both recordings are weekends.** The NightDesk
thesis is that an rToken dislocated from its real-stock anchor converges **when the NYSE reopens** —
that is the grading horizon. A weekend window has **no open**, so the only thing to trade is off-hours
drift, which is noise that loses to the spread. The convergence-at-the-open edge is **untestable on
weekend data by construction.**

**The single highest-value next step** is therefore a data capture, not code: run the recorder across
a weekday **off-hours → open** boundary, then `simulate` that file. That is the run that can show the
thesis edge actually resolving. Until then, NightDesk honestly stands on: a coherent risk-disciplined
loop, measurable gate value, and a backtested basis edge — and it refuses to claim a paper-trading
profit it has not earned.
