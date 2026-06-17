# Bulletproof Verification Log — live Bitget API, Sunday Jun 14 2026 ~10:06 UTC

Every load-bearing assumption tested against ground truth (not re-reasoned). This file is itself submission evidence: "every core claim verified against the live API, timestamped."

## V1 — WEEKEND TRADING: RESOLVED (was unknown/"dropped")
Tested on a Sunday (US market closed). Result:
- **Perps trade 24/7 with REAL weekend volume.** AAPLUSDT perp: continuous 1-min candles, e.g. 10:03 UTC vol=4.12, 10:04 vol=0.12. Actively traded right now.
- **rToken spot: live-QUOTED but ~ZERO weekend volume.** RAAPLUSDT candles sparse, vol=0 across Fri-night→Sun. Ticker bid/ask fresh (<2s) but no real trades.
- **Ondo spot: live-quoted, books present.**
- Control BTCUSDT: live.
→ **Verdict:** Weekend mode IS viable — **perp leg only** (the liquid, tradeable instrument); rToken spot is observe/measure-only on weekends. PegWatch measures dislocations all weekend. This is a differentiator, not a thing to drop.

## V2 — rTOKEN ORDER BOOK: INTERMITTENT (corrects earlier "no book ever")
- Right now: **9/19 rTokens have live 15-level L2 books; 10/19 empty.** With-book = megacaps (AAPL, TSLA, NVDA, MSFT, GOOGL, AMZN, META…). Empty = RSPY, RQQQ, RPLTR, RCRCL, RHOOD, RMSTR, RORCL, RNFLX, RBABA, RGME.
- Jun 12 snapshot had RAAPL **empty**; Jun 14 RAAPL has a **full book**. → book presence varies by name AND time.
- **Ticker bid/ask is ALWAYS present** (RFQ quote), even when L2 empty.
- Perps + Ondo: full books + volume, always.
→ **Verdict:** BitSim must be **QUOTE-FIRST for rTokens** (fill off ticker bid/ask + spread/slippage model), L2 depth as optional refinement when present. Depth-first only for perps/Ondo/crypto. (My earlier "L2 impossible for rTokens" was overstated; the correct fix is quote-first-with-optional-depth.)

## V3 — THREE-PRICE / sVALUE: confirmed real dislocations + sValue still needed
Live (Sunday): AAPL → rToken 291.33 / perp 291.30 / Ondo 293.39 (Ondo +0.7%). TSLA → rToken 406.34 / perp 408.06 / Ondo 407.85 (perp highest). NVDA → rToken 205.41 / perp 206.19 / Ondo 205.63 (perp highest).
→ Divergences are real and **mixed in direction** = genuine cross-venue dislocation, not just dividend drift. sValue total-return adjustment still required for correctness around dividends/splits (use Playbook dividend/split calendars), but the live signal is dominated by real dislocation. PegWatch: normalize sValue → then measure dislocation.

## V4 — AGENT HUB EXECUTION: read-only CONFIRMED (wedge holds, now bulletproof)
- Official `bitget-mcp-server@1.1.0` compiled source: `readOnly` ×7, `read-only` ×3, **ZERO** order/place/create/cancel/trade tool names.
- `claude mcp list`: only the read-only `market-data` MCP is connected; no trading MCP.
- + Bitget FAQ: "order execution is not fully implemented; positions sync to a simulated account."
→ **Verdict:** "Teams' agents have no real-execution hands — positions only sync to a sim account" is TRUE, now confirmed by the server source itself, not just the FAQ. BitSim (real fill-sim with slippage/fees/latency) fills a genuine gap. Wedge is solid.

## V5 — FEES + FUNDING
- Live fees: rToken spot 0.1%/0.1%, Ondo spot 0.1%/0.1%, perp 0.06% taker / 0.02% maker. → **round-trip basis trade ≈ 0.32%** + slippage. Need a fee-aware minimum-edge gate.
- Funding: all stock perps = 0 right now (weekend). Free carry now; account for non-zero funding on weekdays in basis math.

## V6 — DATA QUALITY TRAP
- rToken ticker `usdtVolume` field is GARBAGE (rAAPL showed $15.4B; candles show vol=0). **Never use ticker usdtVolume for rTokens** — use candle volume / trades endpoint.

## Still NOT verified (carry as open, don't assert)
- ±3% mark-price clamp: not re-confirmed from official docs this pass — re-cite original source before showing judges.
- rToken spot RTH (weekday) liquidity depth — only saw off-hours/weekend (vol=0). Test Monday RTH to size the spot leg realistically.
- Bitget ON-pair accrual mode (price-embeds-sValue vs balance-rebase) — test across a dividend date.
- MU Jun 24 earnings + FOMC Jun 16-17: confirm directly.
