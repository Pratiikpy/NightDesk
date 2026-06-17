# PegWatch — Product PRD & Phased Roadmap
**The fair-value & risk layer for tokenized real-world assets.**
v1.0 · Jun 14 2026 · grounded in the honest finding (see `evidence-summary.md`): this is a *price-truth / risk* layer, NOT a trading-alpha product.

---

## 0. One-liner & mission
**PegWatch is the neutral price-truth layer for tokenized real-world assets** — it computes what every tokenized stock/ETF/RWA is *actually* worth in real time, measures how far each venue's price has dislocated, and warns holders and protocols before a stale or broken price wrecks them.

**Mission:** make the tokenized-RWA category *safe to hold, lend against, and build on.* Positive-sum infrastructure, not extraction.

## 1. The validated insight (why this, not a bot)
We trade-tested the obvious "convergence alpha" on real Bitget data and **proved it doesn't exist on the tradeable leg** (the perp is the real-time truth; the token lags; the perp-leg backtest lost −14%). What *does* exist and is valuable: **dislocations are real, measurable, and resolve ~93% of the time** — i.e. a *monitoring/risk signal*, not a trade. So the right product is the **fair-value reference + risk alerts**, and an agent disciplined enough to *not* fake trades. (This honesty is the moat: trust compounds.)

## 2. Problem
Tokenized RWAs trade ~24/7 across many venues/chains, but the underlying (NYSE/Nasdaq) prices ~32.5h/week. Off-hours and on thin venues, the on-chain price drifts, lags, or breaks — documented dislocations from sub-1% to a tokenized Amazon at **~100×**. Retail can't arbitrage it back (mint/redeem is institution-gated). The result:
- **Holders** buy/hold at ghost prices and get wrecked.
- **DeFi protocols** that accept tokenized stocks as collateral mis-mark it → unfair liquidations & bad debt.
- **Issuers/exchanges** can't easily *prove* their token tracks the underlying.
- **Nobody** publishes a neutral, real-time fair-value/peg reference. As the category scales toward $trillions, this missing layer becomes critical.

## 3. Users & jobs-to-be-done
| User | Job | PegWatch surface |
|---|---|---|
| rToken/xStock holder (retail) | "Am I about to overpay / is this price real?" | App / widget / depeg alert bot |
| DeFi protocol (lending, vaults) | "Mark this collateral correctly so I don't liquidate unfairly" | Fair-value **Oracle / API** |
| Issuer / exchange (Reality, Ondo, Backed…) | "Prove our token tracks the underlying" | **Proof-of-peg** / tracking-quality dashboard |
| Institution / market maker | "Where is the actionable dislocation?" (they *can* arb) | Signal feed / API |
| Researcher / index provider | "Clean cross-venue tokenized-price data" | **Dataset** + fair-value **index** |

## 4. The product (layers)
1. **Fair-Value Engine (core IP):** real-time fair value per asset, off-hours-aware (perp/futures-implied, index betas, cross-venue triangulation across rToken/Ondo/perp, dividend/split sValue handling, ±clamp awareness), with uncertainty bands and a *published accuracy track record*.
2. **Consumer protection (the wedge):** dead-simple app / browser widget / Telegram-X bot: "rAAPL is 1.7% above fair value — likely stale, expect reversion." Free, viral, builds trust + data.
3. **Oracle / API (the scale play):** a robust fair-value feed DeFi protocols consume to mark tokenized-RWA collateral → prevents unfair liquidations. The "Chainlink-for-tokenized-RWA-fair-value."
4. **Proof-of-Peg (issuer/institutional):** neutral tracking-quality verification — tracking error, dislocation frequency, recovery time — that issuers cite and auditors/regulators trust.
5. **Data & Index:** the cross-venue/cross-chain historical price-truth dataset (nobody has it) → a tokenized-equity fair-value index, benchmarks, research.
6. **Honest risk agent:** autonomous monitoring + alerting; for those who *can* act, surfaces actionable dislocations; disciplined enough to do nothing when there's no edge ("0 forced trades").

## 5. Differentiation & moat
- **Accuracy IP** — getting off-hours fair value *right* is genuinely hard and defensible.
- **Neutrality & a public accuracy record** — to be THE reference you must be independent + verifiable. Trust is the product and it compounds.
- **The dataset** — first to record cross-venue tokenized prices = a data moat that grows daily.
- **First-mover category ownership** — name and own "price-truth for tokenized assets" before it has a name.
- **Honesty** — we publish what works *and what doesn't*; that's the credibility competitors claiming alpha can't match.

## 6. Phased roadmap
### Phase 0 — Hackathon wedge (NOW → Jun 25) · *submittable*
Ship the live monitoring layer + proof, framed honestly as the seed of the category.
- PegWatch live across all Bitget rTokens (fair value, depeg states, 3-price triangulation) — **public URL**.
- Depeg **alert bot** (Telegram/X) posting real dislocations.
- The **disciplined agent** running unattended → live "N nights, 0 forced trades, auto-graded" record.
- **Reproducible evidence**: the 93% dislocation-resolution study + the honest perp-leg negative result (one command).
- Submission framed as: *"the fair-value/risk layer tokenized stocks need — and the honest agent that won't fake alpha."*

### Phase 1 — Consumer protection (0–3 mo)
- Polished holder app/widget/bot on Bitget rTokens; onboarding-free "is this price real?" check.
- **Public live accuracy track record** (fair value vs the real open) — the trust asset everything else rests on.
- Goal: first 1k users; daily depeg alerts; brand = "the price-truth people check."

### Phase 2 — Oracle/API + multi-venue (3–9 mo)
- Harden the fair-value engine into a consumable **Oracle/API**; first DeFi protocol integration (collateral marking).
- Expand beyond Bitget: xStocks (Kraken/Backed), Ondo Global Markets, Dinari → cross-venue fair value.
- Goal: 1–3 protocol integrations; the dataset becomes a sellable asset.

### Phase 3 — Cross-chain + proof-of-peg + index (9–18 mo)
- Multi-chain oracle (Ethereum/Solana/BNB…); **proof-of-peg** product for issuers; the **fair-value index**.
- Goal: become a default reference for tokenized-RWA marking; institutional/issuer customers.

### Phase 4 — The price-truth layer for all tokenized RWAs (18 mo+)
- Every asset class (stocks → ETFs → bonds → commodities → private credit); the neutral reference the category quotes.

## 7. Success metrics
- Phase 0: live uptime, depeg alerts posted, autonomous nights w/ 0 forced trades, reproducible study, API-call volume.
- Phase 1: users, alert subscribers, **published fair-value accuracy** (median error vs real open beats last-close baseline).
- Phase 2: protocol integrations, API call volume, oracle TVL-marked.
- Phase 3+: assets covered, venues/chains, issuer customers, index adoption.

## 8. Business model (how it sustains)
- **Oracle/API** subscription per protocol (the core revenue, like data/oracle infra).
- **Proof-of-peg / verification** for issuers & exchanges.
- **Data & index** licensing.
- **Premium consumer** alerts (freemium); free tier drives the trust + data flywheel.

## 9. Honest risks & unknowns
- **Fair-value accuracy is the whole game** — if the off-hours model isn't reliably better than naive baselines, there's no product. (Must publish the track record openly.)
- **Oracle adoption is slow** — the consumer wedge funds the wait.
- **Neutrality vs the host** — if too tied to one exchange, loses cross-venue trust; must be independent and even-handed.
- **The category could stall** — tokenized-RWA growth is a bet (a strong one, but a bet).
- **Manipulation/edge cases** — an oracle is an attack target; needs robust methodology + circuit breakers.

## 10. Why it's beneficial (the point)
It protects ordinary people from a confusing, opaque new market, and it makes the rails safe so the category can grow without blowing people up. The best, biggest version of this isn't a bot that wins money from someone else — it's the **trust layer that lets a whole asset class exist safely.** That's worth building with or without a prize.
