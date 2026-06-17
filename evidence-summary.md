# NightDesk — Evidence Summary (Track 3)

Real, verifiable evidence produced by our own engine on **real Bitget rToken + perp data**.
Reproduce: `npm run backtest` (hourly) / `npx tsx src/index.ts backtest --daily`. Raw reports in
`data/research/history-study-*.json`. Live system records in `data/snapshots/` and `data/ledger/`.

## The headline number (the thesis, proven)

**Tokenized-stock premiums are strongly, measurably mean-reverting on Bitget — dislocations are
temporary and converge.** Across all 19 basis pairs:

| Timeframe | Observations | Stretches (≥0.5%) | Converged within horizon | Out-of-sample |
|---|---|---|---|---|
| Hourly (h=6) | 13,269 | 186 | **93%** (avg narrowing 0.49pp) | 91.4% → **97.7%** |
| Daily (h=1) | 1,388 | 43 | **100%** (avg narrowing 0.80pp) | 100% → 100% |

This is the core Track-3 claim, quantified on real data and validated out-of-sample.

## Basis backtest (illustrative, fee-netted)

Long-rToken / short-perp when premium stretches, close on reversion. Premium-space, net of fees:

| | Hourly | Daily |
|---|---|---|
| Trades | 17 | 14 |
| Total PnL | +10.6pp | +12.2pp |
| Cost sweep (0.3 / 0.5 / 0.8% fee) | +14.0 / +10.6 / +5.5pp | +15.0 / +12.2 / +8.0pp |

Positive and **cost-robust** on both timeframes.

## ⚠️ DECISIVE FINDING — the tradeable test (run it: `npm run backtest`, line "A*")

We trade-tested the signal on the **liquid perp** (real fills), treating the rToken as the fair-value oracle. Result on real data: **−14.45%, 41% win rate over 17 trades.** Translation: **the rToken is the laggard, the perp is the real-time truth** — the rToken converges to the perp, not the other way around. So there is **no harvestable convergence alpha** by trading the liquid leg; the +10.6pp "basis PnL" was an artifact of assuming you can trade the zero-volume rToken (you can't).

**This repositions the project honestly — and more strongly:**
- NightDesk/PegWatch is **NOT a profitable trading bot.** Do not pitch alpha. A trader-judge will ask "did you trade the liquid leg?" and the honest answer is "it loses."
- It IS a **fair-value / depeg MONITORING & RISK layer**: it detects when an rToken's displayed price is **stale/dislocated from the live market** and warns holders ("don't get wrecked by ghost prices" — the original problem statement). 93% of flagged dislocations resolve → the signal is real and useful as *monitoring*, not as a trade.
- The autonomous agent's **vetoes are the integrity thesis**: a disciplined agent that refuses to fake alpha when there's no edge. "0 interventions" + "knows when NOT to trade" > "another bot claiming profits."
- Pitch axis = **transparency/risk/ecosystem-trust** (Filippo/data, Vlad/transparency, Gracy/rToken trust), NOT returns.

## Brutally honest caveats (state these in the pitch — judges are traders)

1. **rToken candles are mark-priced (zero volume).** The basis PnL assumes we transact at the
   rToken mark; live fills on the thin rToken leg are uncertain. Treat A as **illustrative, not a
   live track record.** The liquid, tradeable leg is the perp.
2. **High capture is partly mechanical.** A mean-reverting spread narrows after a stretch almost by
   construction; the real, defensible statement is "premiums are strongly mean-reverting (avg
   stretch narrows ~0.5–0.8pp within hours), and this holds out-of-sample" — not "we win 100% of
   trades."
3. **Short history.** ~3 months of rToken↔perp overlap (perps launched ~Mar 16 2026); trade counts
   are small (14–17). This is early evidence, not a multi-year record.
4. **Peg-tracking edge (B) did NOT validate.** The perp anchor does not reliably beat last-close as
   a *level* predictor (hourly −1.4%, daily +0.2% — inconclusive). Our edge is **convergence
   capture**, not price-level prediction. We do not claim B.

## What this gives Track 3

- **Real problem in tokenized US stocks** ✅ — measured dislocations on live Bitget rTokens.
- **Verifiable backtest / sim records** ✅ — 13k+ premium observations, out-of-sample convergence
  study, basis backtest, all reproducible from one command; plus live `data/snapshots` + `data/ledger`.
- **Uses Bitget US-stock data/tools** ✅ — every input is live Bitget rToken/perp data; plus the
  completed Bitget Playbook backtest (`getagent-capabilities.md`) and Skill Hub integration.

## Companion evidence
- **Live loop** on real qwen3.6-plus (council transcript in `data/ledger/`), 0 human interventions.
- **Bitget Playbook** completed backtest (BTC, run `pbrun-dc30391515e3`) — methodology + tool proof.
- **Recorder** dataset (`data/snapshots/`) — timestamped rToken/Ondo/perp series nobody else has.
