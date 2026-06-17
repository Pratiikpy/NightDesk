# Gauntlet Confidence Report — what the firewall actually guarantees

**Reproduce:** `npm run gauntlet data/snapshots/2026-06-14.jsonl` and `…/2026-06-15.jsonl`.
**TL;DR:** The firewall's guarantee is **safety, not alpha.** Across every reckless agent on every
recorded session, **no unsafe trade intent ever passed** — but the PnL effect is window-dependent and
must be read as a *fixture*, not a universal profit claim.

## Method
Four reckless agent archetypes (`naive_gap`, `perp_trust`, `random`, `momentum`) trade two real
recorded Bitget sessions, **unguarded** vs **firewall-guarded** (each intent must pass a fresh
certificate), with the same fill + cost model. Columns: `trades / losers / net%` (unguarded) and
`trades / blocked / losers / net%` (guarded).

## Results

**Session 2026-06-14** (anchor unreliable for much of the recording → the firewall blocks heavily):
| agent | unguarded (tr/losers/net%) | guarded (tr/blocked/losers/net%) |
|---|---|---|
| naive_gap | 17 / 16 / **−4.47** | 0 / 17 / 0 / **0** |
| perp_trust | 17 / 16 / −4.47 | 0 / 17 / 0 / 0 |
| random | 17 / 16 / −17.12 | 0 / 17 / 0 / 0 |
| momentum | 17 / 17 / −21.50 | 0 / 17 / 0 / 0 |

**Session 2026-06-15:**
| agent | unguarded | guarded |
|---|---|---|
| naive_gap | 19 / 15 / **−20.88** | 10 / 9 / 3 / **+0.34** |
| perp_trust | 4 / 1 / +7.52 | 2 / 2 / 1 / −0.13 |
| random | 19 / 12 / −8.40 | 5 / 14 / 1 / −0.32 |
| momentum | 19 / 5 / **+12.13** | 0 / 19 / 0 / **0** |

## The universal claim (what we *do* guarantee)
> **In every run above, zero unsafe trade intents passed the firewall.** A certificate is required,
> and stale / news-driven / liquidity-trapped / non-tradeable markets are rejected.

This isn't asserted from these two sessions — it's **formally property-tested**: a seeded 5,000-state
fuzz, fast-check property tests over generated toxic states, and an external-agent property test all
assert the same invariant (`test/kernel.test.ts`, `test/kernel.property.test.ts`,
`test/external-agent.integration.test.ts`). The gauntlet is the *live demonstration* of that property.

## The honest caveat (what we do NOT claim)
- **Guarded does not always beat unguarded on PnL.** On 2026-06-15 the `momentum` chaser made
  **+12.1% unguarded** in that window while the firewall blocked it to 0. A reckless agent *can* win
  a lucky window — the firewall's job is to refuse unsafe trades, not to maximise PnL.
- **The headline "−20.9% → +0.3%" is a reproducible fixture**, not a law. It shows the firewall turns
  a reckless gap-chaser's losses into roughly break-even *on that session* by blocking the trades it
  shouldn't take — consistent with our null edge (we claim no alpha).
- **Both recordings are off-hours/weekend** (no NYSE open), so convergence can't resolve; the PnL is
  spread/cost dominated. The safety property is what generalises; the PnL is not.

## Why this matters
Reproducibility surveys of LLM trading agents find rigorous cost modelling, survivorship handling,
and replayable artifacts are rare. NightDesk's signed ledger + reproducible gauntlet + property-tested
safety invariant directly attack that gap — and we state the limits of the PnL evidence in writing
rather than hiding behind one good number.
