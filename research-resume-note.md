# Deep-research workflow — PAUSED (resume instructions)

Paused 2026-06-11 at user request (usage limit). Completed agents are journaled/cached — resuming re-runs only what's left (~50 verification votes + final synthesis).

UPDATE (2nd attempt, Jun 11/12): resume ran briefly, then session limit hit (resets 9:50am Asia/Calcutta) — workflow stopped itself. Checkpoint grew: now 6 confirmed claims incl. IMPORTANT FLIP — "rTokens 1:1 collateralized by real US equities, FINRA/SIPC broker-dealer custody, DTCC registration, >100% reserves, The Network Firm attestations" is now CONFIRMED (was outage-refuted). Still pending: all Ondo-mechanics votes, Oracle-earnings votes, fee-parameter votes, judges + competitive threads, final synthesis. Resume after 9:50am with the same three params below.

## To resume
Invoke Workflow with ALL THREE of:
- scriptPath: `C:\Users\prate\.claude\projects\C--Users-prate-downloads-bitget\324ef871-96f1-4afd-8ddd-362b9db2db1f\workflows\scripts\deep-research-wf_bca0336b-c35.js`
- resumeFromRunId: `wf_bca0336b-c35`
- args: the EXACT original research question (verbatim below — prompts must match for cache hits)

## Original args (paste verbatim)
Research for Bitget AI Base Camp Hackathon S1 (May 27 – Jun 30, 2026) entry "NightDesk/PegWatch" — a fair-value/depeg engine + autonomous convergence-trading agent for Bitget's tokenized US stocks (rTokens), competing for the all-tracks #1 prize. Five research threads:

1. BITGET rTOKEN MECHANICS: Bitget "Stocks 2.0" rTokens (rAAPL, rTSLA, RAAPLUSDT etc., launched ~Oct 2025 based on candle history). Who issues them (Bitget itself? Backed Finance? other?), mint/redeem mechanics, collateralization, the documented ±3% mark-price clamp during US market closure, why their spot order book endpoint returns empty while ticker shows live bid/ask (market-maker/RFQ quote model?), trading hours including weekends, any official Bitget docs/announcements on microstructure.

2. ONDO TOKENS ON BITGET: Bitget lists Ondo Global Markets tokenized stocks (AAPLON, TSLAON, SPYON etc.). How are ON tokens priced/redeemed, what oracle/NAV mechanism, trading hours, redemption friction — needed to interpret premium/discount between rAAPL vs AAPLON vs AAPLUSDT perp on the same exchange.

3. EARNINGS + MACRO CALENDAR Jun 11–25, 2026: Confirmed US earnings dates in this window for: ORCL (Oracle — typically reports mid-June, may be imminent), MU (Micron — believed Jun 24 after market close, verify), and any of: AAPL TSLA NVDA MSFT GOOGL AMZN META PLTR CRCL HOOD MSTR NFLX BABA GME COIN AVGO INTC AMD UBER LLY ABNB UNH. Also confirm FOMC meeting Jun 16-17 2026 with SEP/dot plot and presser.

4. COMPETITIVE LANDSCAPE: Does ANY existing product compute fair value / depeg alerts for tokenized US stocks (Bitget rTokens, Kraken/Bybit xStocks, Ondo Global Markets, Backed, Dinari)? Check XEdge (Kraken xStocks hackathon Apr 2026 winner, multi-agent LLM trading). What are other Bitget Hackathon S1 teams building — search X/Twitter #BitgetHackathon posts and @Bitget_AI replies for competitor projects. Is "nobody has built the fair-value layer" still true?

5. JUDGES & WHAT WINS: Bitget hackathon judges include Gracy (likely Gracy Chen, Bitget CEO), "Filippo Dune", "Henry Kite", "Vlad Evedex", ~30 industry figures, plus Foresight Ventures (media/ecosystem partner) and incubator judges. Research who these judges are, their public statements/posts about AI agents/trading/crypto, what they celebrate and criticize. Also: what kinds of projects historically win crypto/AI hackathon GRAND prizes (vs track prizes) — infra vs consumer demos vs trading bots; what made winners win (e.g., ETHGlobal, Solana Colosseum, Kraken xStocks hackathon results).

SYNTHESIS GOAL: produce (a) verified facts changing our build (with citations), (b) confirmed event calendar for showcases, (c) honest competitive verdict on novelty claim, (d) judge-taste profile, and (e) the remaining weaknesses/"minus points" of NightDesk/PegWatch with concrete kill-or-mitigate recommendations to maximize all-tracks #1 probability.

## Round-1 salvaged findings (already reported to user, partial output at:)
`C:\Users\prate\AppData\Local\Temp\claude\C--Users-prate-downloads-bitget\7ab4443d-6b52-4775-9c30-4431e99e7b69\tasks\w4tub90sx.output`

Key verified: rTokens issued by "Reality" (Bitget's RWA arm, launched Jun 2 2026, broker-routed = explains empty order book); rTokens closed weekends, overnight session 8pm–3:59am ET exists. High-confidence pending re-verify: Ondo total-return/sValue trap; fee asymmetry (spot 0.1% vs perp 0.02/0.06%); Micron Jun 24 confirmed; Oracle already reported (showcase dead). Pending entirely: judges profile, competitive scan verdict, final synthesis + minus-points list.
