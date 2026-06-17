# Token Safety Standard v1.0 — how NightDesk grades a tokenized US stock

A transparent, reproducible standard for whether a Bitget tokenized stock is safe for an autonomous
agent to trade. Every number is computed from real data; legal facts we cannot verify are marked
"not verified," never fabricated. This is a **safety / data-quality** standard, **not** an alpha
signal. Reproduce: `npm run flags` (quality board) and `npm run certify` (signed certificates).

## 1. Classification (the cause of any gap)
Computed by the Gap Causality Engine from the live row + perception context (`src/perception/causality.ts`):

| Classification | Meaning | Allowed policy |
|---|---|---|
| **FAIR** | no actionable gap vs the real-stock anchor | NORMAL |
| **MISPRICED** | a real dislocation, no catalyst (noise / perp-illusion) | LONG-ONLY FADE (cheap) · WATCH (rich) |
| **NEWS-DRIVEN** | fresh company catalyst → gap may be real | ABSTAIN |
| **MACRO-RISK** | high-severity macro day (FOMC/CPI/PCE) | ABSTAIN |
| **ISSUER-RISK** | rToken / Ondo / perp legs disagree | AVOID |
| **LIQUIDITY-TRAP** | no tradeable quote | BLOCK |
| **STALE** | no usable real-stock anchor | ABSTAIN |

"Rich" rTokens map to **WATCH**, not a short, because rToken spot isn't cleanly shortable and the
perp proxy diverges from the rToken-vs-real gap (long-only by design).

## 2. Safety score (0–100, transparent, NOT alpha)
A weighted blend of measurable data-quality + tradeability factors (`src/research/certify.ts`):

```
safety = 0.25·tracking + 0.20·liquidity + 0.15·freshness + 0.25·eventSafety + 0.15·execution
```
- **tracking** — from the A–D quality grade (A 100 / B 80 / C 60 / D 35).
- **liquidity** — L2 book 100 · quote-only 60 · none 15.
- **freshness** — live NYSE 100 · last-close (off-hours) 70 · none 25.
- **eventSafety** — quiet 100 · macro day 50 · fresh news 40.
- **execution** — fadeable 100 · no-gap 90 · abstain 60 · avoid 40 · block 50.

## 3. Reliability grade (A–D), from the quality board
Graded on the **robust level gap** — the average daily |rToken − real stock| / real stock
(`src/history/tracking.ts`), blended with stability + liquidity:

| Grade | Reading | Policy band |
|---|---|---|
| **A** (≥85) | tracks tightly, steady, liquid | NORMAL / LONG-ONLY FADE |
| **B** (≥70) | tight, minor noise | WATCH / LONG-ONLY FADE (capped) |
| **C** (≥55) | loose / volatile | WATCH / ABSTAIN in high-vol |
| **D** (<55) | poor tracking or thin | AVOID / BLOCK |

Return-correlation is reported only as a **caveated diagnostic** (it is confounded by the rToken's
00:00-UTC close vs the ~21:00-UTC NYSE close); the grade uses the robust level gap, not correlation.

## 4. Position size cap
A certificate's `maxSizeUsd` scales with safety for tradeable policies, and is **0** for any
non-tradeable policy: `maxSizeUsd = max(0, (safetyScore − 60) / 40 × $100)`.

## 5. Legal rights — never fabricated
Dividends, voting, corporate-action treatment, and redemption rights are marked
**"not verified — see issuer"**. NightDesk has no authoritative source for them and will not invent
them; they are surfaced as explicit unknowns, not folded into any score.

## 6. Honest scope
This standard certifies **safety and data quality**, not profitability. NightDesk's own edge test
(true-gap reversion) is **null at the daily horizon**, and we report that publicly. The standard's
value is preventing agents from trading stale, news-driven, issuer-distorted, or untradeable prices —
not predicting returns.
