# Deep Research Findings — NightDesk/PegWatch (Jun 12, 2026)

Adversarially verified: 22 sources → 108 claims → 25 voted → **21 confirmed / 4 refuted** → 12 merged findings. Full raw output preserved by workflow; this is the actionable digest. Confidence labels per finding.

---

## A. Verified facts that change the build

### A1. rTokens are issued by "Reality" — Bitget's RWA arm (HIGH, 3-0)
- Reality (realityfinance.xyz) = licensed RWA issuance platform "within the Bitget ecosystem"; announced **May 26, 2026** (day before hackathon). NOT Backed Finance, NOT Bitget-the-exchange directly.
- **Pitch wording matters (both blunter framings were refuted):** say *"issued by Reality, Bitget's RWA arm."* Never "Bitget issues them" or "Reality is independent."
- rTokens = economic exposure only, no shareholder rights.
- Sources: bitget.com/blog (Reality launch), Bitget Academy Reality guide, The Block.

### A2. TIMELINE CORRECTION — Stocks 2.0 launched June 2, 2026 (HIGH, 3-0)
- 36 stock-linked assets listed at launch. The "~Oct 2025" candle history belongs to the predecessor Stocks 1.0/Ondo phase (>$1B cumulative volume by Jan 2026).
- ⚠️ **Backtests on old RAAPLUSDT candles span TWO product regimes.** Label any pre-Jun-2026 data as regime-1; treat post-Jun-2 data as the live product.

### A3. Broker-routed microstructure CONFIRMED (HIGH, 3-0 incl. live API re-check by a verifier)
- rToken orders route into real Nasdaq/NYSE liquidity via licensed brokers; real-time share purchase on buy; async netted settlement supported.
- Explains our empty order-book discovery (verifier reproduced it live: empty book + ticker bid 293.06/ask 293.44).
- **PegWatch treats rToken pairs as quote-driven: ticker top-of-book is the signal; there is no depth.**
- Note: real-time broker routing is physically impossible when US markets are closed → the pricing mechanism NECESSARILY changes off-hours. That regime change is itself PegWatch's story.

### A4. rToken collateral claims are ISSUER-ASSERTED (MEDIUM, 2-1/3-0 merged)
- Bitget/Reality state: >100% reserves, segregated custody via unnamed FINRA-registered SIPC-member broker-dealer, DTCC registration, attestations by The Network Firm (real crypto PoR CPA firm), live Proof-of-Asset dashboard.
- **No published attestation PDF was located.** Frame in pitch as "Bitget states…" — positioning PegWatch as the independent third-party verification layer is itself the credibility win.

### A5. Hours (HIGH, 3-0)
- Reality mint/redeem: 24/5 with stablecoins. Trading: four US-aligned sessions (Pre 4:00–9:29am, Regular 9:30–3:59, Post 4:00–7:59pm, **Overnight 8:00pm–3:59am ET**). No weekends/US holidays via Reality.
- ⚠️ "Secondary venues may set their own availability rules" — **Bitget's own RAAPLUSDT weekend behavior must be tested empirically (this Saturday), not assumed.**

### A6. THE ONDO sVALUE TRAP — build-critical (HIGH, 3-0, x3 claims merged)
- ON tokens are **total-return instruments**: `Token Price = Underlying Equity Price × sValue multiplier` (dividends auto-reinvested net of ~30% withholding; corporate actions via oracle pause + manual confirm for >1% moves).
- On Ethereum the PRICE drifts above per-share spot; on Solana/BNB (Scaled UI) BALANCES rebase and price tracks per-share.
- **A fair-value engine comparing AAPLON to AAPL/rAAPL without the sValue adjustment misreads dividend drift (~0.4%/yr AAPL, ~1.2%/yr SPYON) as depeg — and a stock split = instant catastrophic false signal.**
- **UNKNOWN: which mode Bitget's ON pairs use.** Empirically testable: compare Bitget ON ticker vs Chainlink feed vs raw spot across a dividend date.
- This is the single most demo-able domain-expertise moment vs naive competitors.

### A7. Chainlink 24/5 equity feeds exist for Ondo tokens (HIGH, 3-0)
- Live for SPYon/QQQon/TSLAon on Ethereum (Ondo's official oracle, used by Euler). Aggregates regular/pre/post/overnight sessions.
- **PegWatch gains an independent on-chain fair-value anchor** — but feeds smooth overnight + freeze during corporate-action pauses, and nothing says Bitget prices its ON pairs off Chainlink.

### A8. Ondo redemption friction = our signal's reason to exist (HIGH, 3-0/2-1 merged)
- Issuer: Ondo Global Markets (BVI) Limited — bankruptcy-remote SPV; tokens are debt instruments. Zero mint/redeem fees "at this time"; instant atomic 24/5 (Sun 8:00pm ET–Fri 7:59pm ET, four daily pauses, discretionary halts).
- **Arb channel requires Ondo BVI KYC, institutions-only, US persons prohibited → Bitget retail CANNOT arb directly.** Dislocations can persist.
- **WEEKEND STRUCTURAL ANOMALY WINDOW: Bitget ON pairs trade 24/7 but primary redemption is closed Fri ~8pm–Sun 8pm ET → weekend premiums float with NO redemption anchor.** Predictable, schedulable PegWatch showcase every single weekend.

### A9. Problem premise validated by independent evidence (MEDIUM)
- Ondo's own docs (about competitors' tokens): "Low liquidity and high-friction minting and burning... discourages arbitrage, allowing dislocations to widen and persist."
- **AMZNX ~100x premium (July 2025) went un-arbitraged due to T+N redemption friction** (PANews) — the strongest real-world exhibit.
- ⚠️ Don't present Ondo's page as Ondo admitting its own tokens depeg — it's their competitive-positioning doc.

### A10. The triangle is real and structurally diverse (HIGH, 3-0 x3)
- 15 Ondo pairs on Bitget (incl. IVVON, IWMON, ITOTON + metals IAUON/SLVON — note: metals trusts, not equities), 24/7, USDT-settled, ERC20s with published Etherscan addresses (AAPLON=0x14c3..., TSLAON=0xf6b1...), withdrawable on-chain since Mar 19, 2026.
- rTokens disclose NO contract addresses, not even a chain. Bitget's own disclaimer: "Ondo stocks and ETFs are issued by Ondo. Bitget is not the issuer."
- Different issuers, custody chains (Ondo via Alpaca Securities; Reality via unnamed BD), redemption rails, transferability → documented structural basis for measurable rToken-vs-ON divergence.

### A11. Calendar (HIGH for ORCL; MU/FOMC unverified)
- **ORCL reported Jun 10 AMC** (Q4 rev $19.2B +21%, EPS $2.11) — already past. NOT an upcoming catalyst. BUT: the Jun 10–11 overnight session is a ready-made historical case study (candles exist), and post-earnings drift was live Jun 11.
- **MU Jun 24 and FOMC Jun 16–17: still assumptions** — sources were fetched (stocktitan MU announcement, federalreserve.gov calendar) but votes didn't complete. Verify directly before relying.

### A12. Live fees (verified from Bitget API directly, Jun 12)
- rAAPL spot: 0.1% taker / 0.1% maker. AAPLON spot: same. AAPL perp: 0.06% taker / 0.02% maker.
- **Round-trip taker basis trade ≈ 0.32% + slippage + funding → minimum profitable depeg width. Gate #13 (fee-aware minimum edge) uses these numbers, pulled live from API at runtime.**

## B. REFUTED — purge from all docs/assumptions
1. "x-suffix" symbols (TSLAx/AAPLx) ≠ our universe — that's xStocks/Backed on Bitget Wallet/Onchain, a separate product line. Ours: r-prefix rTokens + ON-suffix Ondo + USDT perps.
2. Fee schedule sourced from the 2026 stock-trading guide article (numbers happened to match the live API, but cite the API, not the article).
3. "Bitget itself is the issuer" and "Reality is fully independent" — both wrong (see A1 wording).
4. 1:1 collateralization as established fact — it's issuer-asserted (see A4).

## C. Still open (research gaps)
1. **Competitive thread: ZERO surviving verified claims.** "Nobody has built the fair-value layer" = *not contradicted* but *unconfirmed*. XEdge/teams scan incomplete.
2. **Judges thread: ZERO surviving verified claims.** Gracy/Filippo/Henry Kite/Vlad profiles + grand-prize patterns unanswered.
3. ±3% mark-price clamp: NOT re-verified this pass — re-cite from original source before showing judges.
4. Bitget ON pair accrual mode (sValue-in-price vs rebase) — empirically testable (A6).
5. Bitget rToken spot weekend behavior — test Saturday (A5).
6. MU Jun 24 / FOMC Jun 16–17 confirmation (A11).

## D. Minus-points ledger (kill-or-mitigate status)
| # | Minus point | Status |
|---|---|---|
| 1 | Huge scope vs finishing | OPEN — mitigated by cut-list (MCP adapter + terminal = crown jewels) |
| 2 | BitSim adoption uncontrollable | KILLED — passive distribution; claim = shipped open-source layer |
| 3 | CME data dependency | KILLED — Bitget perp anchor (+ Chainlink feeds for ON legs, new) |
| 4 | rMU doesn't exist | KILLED — Micron showcase on MUUSDT perp |
| 5 | Naive ON comparison = false depegs | NEW, KILLED IN ADVANCE — sValue adjustment in FR-3.6; detect accrual mode first |
| 6 | Backtest regime break (Jun 2) | NEW — label regimes; prefer post-Jun-2 data for headline metrics |
| 7 | Fee floor unsourced | KILLED — live API fees, 0.32% round-trip floor, fee gate added |
| 8 | Issuer-asserted collateral presented as fact | KILLED — "Bitget states" framing; PegWatch = the independent check |
| 9 | ±3% clamp citation missing | OPEN — re-source before demo |
| 10 | ORCL showcase | DEAD as live event; REBORN as historical case study (Jun 10–11 overnight) |
| 11 | Weekend behavior unknown | OPEN — empirical test Saturday; meanwhile ON-pair weekend no-anchor window is a CONFIRMED showcase |
| 12 | Judges/competitive intel missing | OPEN — needs targeted follow-up (cheap, focused searches; not a full re-run) |

## E. Net effect on the thesis
The research *strengthened* the core idea: the market structure (two issuers + perp on one venue, institutions-only arb, no weekend redemption anchor, off-hours regime change) is **more** dislocated and **more** measurable than the PRD assumed — and the sValue trap means naive competitors will produce provably wrong depeg signals where PegWatch produces right ones. The novelty claim survived adversarial scrutiny (not contradicted). Main unresolved risks are execution scope and the two intel gaps (judges, competitors).
