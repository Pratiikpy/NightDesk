# NightDesk — Project Document (plain-language)

**The autonomous fair-value, safety, and trust layer for Bitget's tokenized US stocks.**
Bitget AI Base Camp Hackathon S1. Primary track: **US Stock AI Trading** — built to be judged for
**all-tracks first place**.

> This document explains the project in plain language: what it is, the problem it solves, what it
> actually does, how it uses Bitget, why it is a genuine autonomous agent, and the honest evidence
> behind every claim. It deliberately contains nothing about screens, layout, or visual design.

---

## 1. The one-sentence version

NightDesk is the **honest referee** for AI agents that trade Bitget's tokenized US stocks: it works
out what each tokenized stock is *really* worth at any hour, explains *why* a price gap exists,
stands down when the gap is driven by real news, and **blocks any trade that is unsafe** — and it
proves every one of those decisions with a tamper-proof, replayable record.

It is not another trading bot trying to get rich. It is the **safety and trust layer** every other
trading agent should have to pass through first.

---

## 2. The problem (why this needs to exist)

Bitget lists "tokenized" versions of famous US stocks — rAAPL (Apple), rNVDA (Nvidia), rTSLA
(Tesla), and others. These tokens trade **24 hours a day, 7 days a week**.

But the **real** Apple or Nvidia share only has a live, trustworthy price while the US stock market
(the NYSE) is open — roughly six and a half hours on weekdays. For the other ~75% of the week, the
real market is closed.

That creates a dangerous gap:

- **Most of the time, nobody actually knows the "fair" price.** The token keeps trading all night
  and all weekend on thin, broker-quoted liquidity, and it drifts.
- **Ordinary people cannot fix the gap.** Creating or redeeming these tokens at fair value is
  restricted to big institutions, so when a token drifts away from the real stock, the gap can
  **persist** instead of snapping back. (One tokenized Amazon once traded at roughly 100× its real
  value — and nobody could close it.)
- **The obvious "second opinion" is a trap.** Bitget also offers a stock *perpetual* (a 24/7
  futures-style contract). You might think you could check the token's price against the perp. But
  the perp is a **blended index built from several token issuers** — so the token and the perp tend
  to move together and **cover for each other**. Comparing them tells you almost nothing.

So an AI agent trading these tokens at 3am is effectively **trading blind**, and the one reference it
would naturally reach for is the one that hides the truth.

---

## 3. The discovery (the thing nobody else is showing)

NightDesk does the one comparison that actually reveals the truth: it measures each token against the
**real underlying stock** — the last official NYSE price (live when the market is open, the last
official close when it is shut).

The result is striking and is taken from live data:

- Measured against the **perp**, almost nothing looks wrong — about **zero** dislocations. Everything
  appears calm.
- Measured against the **real stock**, **17 of 19 tokens were dislocated** off-hours.

In plain terms: **the perp says "all clear" while the real stock says "17 of these are mispriced."**
NightDesk calls this the *perp-illusion*, and revealing it is the project's core contribution.

---

## 4. What NightDesk does, step by step

Every night, with no human involved, NightDesk runs the same disciplined loop:

1. **Look.** It pulls live prices for every tokenized stock from Bitget and the matching real-stock
   price, and it reads the day's financial news and economic-calendar events (e.g. a Federal Reserve
   decision, an earnings release).
2. **Measure the true gap.** It calculates how far each token has drifted from its real-stock anchor —
   the honest gap, not the one the perp hides. For tokens that pay dividends it is built to adjust for
   that first, so an ordinary dividend is not mistaken for a "mispricing" (the exact per-company
   dividend figures are a known, deferred data step — never faked).
3. **Explain the gap.** It classifies *why* the gap exists: ordinary noise, fresh company news,
   a big macro event, an issuer quirk, a thin-liquidity trap, or the perp-illusion. This is the part
   that turns a number into a *reason*.
4. **Decide whether to stand down.** If the gap looks like it is driven by **real new information**
   (a company catalyst or a major macro day), the right move is usually to **do nothing** — the gap is
   probably "real" and will not simply snap back. NightDesk abstains, and it counts that restraint as a
   first-class decision, not a non-event.
5. **Debate, if it is going to act.** A panel of AI "analysts" with different jobs — a bull, a bear, a
   research manager, a three-way risk debate, and a portfolio manager with veto power — argues the case
   and produces a clear yes/no recommendation. The AI only ever gives an **opinion in words**; it never
   touches the money directly.
6. **Run the safety checks.** Every proposed trade must pass **15 hard, non-negotiable risk gates**
   (for example: the expected edge must be bigger than the trading fees, the price data must be fresh,
   the market must not be a liquidity trap). If any gate fails, the trade is **blocked**.
7. **Execute in a realistic simulator.** Approved trades go through an open-source fill simulator that
   models real-world frictions — the spread you actually pay, slippage, fees, and funding costs — so the
   results are honest, not idealised.
8. **Record it permanently.** Every decision — trade, block, or stand-down — is written to a
   **tamper-proof, digitally-signed logbook**. If anyone alters, deletes, or reorders a single entry,
   verification fails. Nothing can be quietly changed after the fact.
9. **Grade itself.** When the US market re-opens, NightDesk checks what actually happened and marks each
   decision a win or a loss — **including the trades it chose not to make**, so its restraint is scored,
   not just its action.

That is the **complete loop, with no human in the middle** — which is exactly what the hackathon's own
manifesto asks for ("a complete loop, no human in the middle; traditional quant can't do this").

---

## 5. The safety gateway (why this is *infrastructure*, not just an agent)

The most important idea in NightDesk is that it does not only *describe* safety — it **enforces** it.

For each token, NightDesk issues a signed, time-limited **certificate** that states: what the token is
worth, how trustworthy it is right now, and the **only** kind of trade an agent is permitted to make
on it. It then runs a **firewall** that any trading agent must pass through. The firewall answers every
incoming trade request with one of three verdicts:

- **ALLOW** — the trade is safe; proceed.
- **ALLOW (capped)** — the trade is safe but too big; here is the maximum safe size.
- **REJECT** — the trade is unsafe; do not place it.

A trade is rejected if it has no valid certificate, an expired or tampered one, the wrong token, or a
forbidden strategy. This was hardened by throwing **thousands of automatically-generated hostile and
random trade requests** at the firewall — it never let an unsafe one through.

This is the part that makes NightDesk *foundational infrastructure*: it is designed to be the **gate
every other trading agent passes through**, not just one more agent competing in the crowd. Any external
AI agent — including ones built on other platforms — can ask NightDesk "am I allowed to make this
trade?" through a standard connector and an over-the-internet request, before it risks any money.

---

## 6. The research lab — and why we are honest about it

NightDesk also includes an **automated strategy research lab**. It searches thousands of candidate
trading strategies, records every trial, and runs them through an **"Overfit Court"** that throws out
the ones that only looked good by luck. It then freezes a single best ("champion") strategy and runs it
as a paper-traded record.

We are deliberately, aggressively honest about what these numbers mean:

- The lab searched roughly **9,700 candidate strategies across ~48,600 recorded trials** and rejected
  **~8,400** as fragile or overfit.
- The frozen champion shows a **positive paper result on the recordings we have** (a few tens of
  dollars of simulated profit on a 1,000-dollar starting balance, with small drawdown).
- **We label this exactly as what it is: results on the recordings we already have — *not* a promise of
  future profit.** It is evidence that the research engine works and is disciplined, not a "we found
  a money machine" claim.

We even keep the profit story and the safety story in **separate frozen champions**, so we can show a
green number without pretending that chasing profit is the real product. The real product is the safety
and trust layer.

---

## 7. The honesty spine (the most important section)

The biggest weakness in any AI-trading project is the temptation to **overclaim** — to dress up a lucky
backtest as a guaranteed edge. NightDesk does the opposite, on purpose, and this is its strongest
selling point.

**We tested our own central money-making idea — and reported that it failed.**

The natural bet is "a dislocated token will snap back toward the real stock by the next session." We
ran that test honestly, and the answer came back **null**: the token moved the "right" way only about
**49.6% of the time — a coin flip**. So we **do not claim a convergence-profit edge.** We say so in
writing, prominently.

We back this up with the kind of controls a professional trader would demand:

- A **"shuffle test"** that shows our most impressive-looking statistic (a ~93% "convergence capture"
  rate) is a **statistical artifact**, not a real edge — and we report that against ourselves.
- A **live check**: a paper session that "captured" the convergence 100% of the time **still lost
  money** — proof that convergence is not the same as profit.
- A demonstration that the **safety gates earn their keep**: the trades the gates *blocked* would have
  *lost* money on average. So the discipline has measurable value even though the strategy alone does
  not.
- A **head-to-head arena**: reckless strategies (e.g. "trade every gap") run on the same market with the
  same costs. On a real recording, the reckless one lost about **−20.9%**; the disciplined NightDesk
  took **far fewer trades and far fewer losers** — it wins by **losing less**, not by magic.

So what *does* NightDesk claim? Four things it can actually prove:

1. **Honest measurement** — it shows the true dislocation the perp hides.
2. **Risk discipline** — hard gates that demonstrably avoid losses.
3. **Restraint** — it stands down when a gap is driven by real news.
4. **Auditability** — every decision is signed, replayable, and self-critical.

**The published null result is not a weakness — it is the receipt that proves the rigor.** A judge who
is a trader will trust a team that says "here's what didn't work" far more than one that promises easy
alpha.

---

## 8. How it uses Bitget (and free public sources)

- **Bitget** is the heart of the project: it provides the live market data for all 19 tokenized-stock
  pairs (the tokens, their blended-index perps, and a second token family used for cross-checking), it
  is the venue these instruments live on, its partner model **Qwen** powers the AI analyst panel, and
  its on-platform backtesting tool (**Playbook**) hosts a deterministic version of the strategy.
- **Free public sources** fill the gaps that Bitget cannot: the real US-stock price and its daily
  history, per-company news, and an economic-events calendar for macro context.
- It runs in **read-only mode by default** — it reads market data and simulates trades, and it never
  needs trade-execution permissions or live funds to produce all of its evidence. It is built so that
  the moment Bitget turns on real agent execution, NightDesk can plug straight into it with no change to
  its decision loop.

The whole universe of instruments is defined in a **single source of truth** that was verified live
against Bitget's public data: **19 tokenized-stock pairs, 7 additional spot-only tokens, 2 perp-only
names (including Micron, used for an earnings showcase), and 10 cross-check tokens.**

---

## 9. Why it is a genuine autonomous agent

- **It perceives** — real-stock prices, true gaps, news, and macro events.
- **It reasons with specialists** — a multi-seat analyst panel that debates structured evidence rather
  than guessing.
- **It remembers** — it learns from each graded night and feeds the outcome back in.
- **It acts on its own, under strict oversight** — the AI only ever produces an opinion; all sizing,
  stops, fills, fee accounting, gates, and grading are done by deterministic, testable code. And it
  **abstains** when the right move is to do nothing.
- **It cannot have "cheated" by memorising the future** — the AI is shown only *live* numeric market
  state and asked for a *qualitative* verdict. It never predicts a price chart it might have seen during
  its training, so there is no way for future prices to leak into its decisions. This is checked
  automatically by a dedicated test.

---

## 10. The evidence (what a judge can verify without trusting us)

Everything is reproducible from a single command, and every claim points to a file a judge can open:

- A full **paper-trading record** with timestamps, assets, direction, price, size, balance change,
  the certificate that authorised it, the verdict, and the reason for every blocked trade.
- A **longer recorded-day replay** showing realised entries and exits.
- Multi-session **out-of-sample** studies and **walk-forward** reports that test the system on data it
  did not tune on.
- A **fill-realism stress test** (empty order books, one-sided books, stale quotes, partial fills).
- A **head-to-head arena** and **counterfactual** reports (what the unrestricted agent would have done
  vs. the guarded path: missed profit *and* blocked losses, both reported).
- A **claim ledger** mapping every major claim to its acceptance test and evidence file.
- A **tamper test** proving the signed logbook fails verification if anything is altered.
- A **hostile-input ("red team") report** and **15-gate coverage report**.
- A live, credential-free **public Bitget read-only proof**.
- A one-command **final audit** that runs the build, the full test suite (currently **215 unit tests,
  all passing**, plus property tests), the security checks, and the complete evidence pack — and reports
  PASS/FAIL honestly, including its own known limitations.

The guiding rule across the whole project: **honesty over hype — every number replayable.**

---

## 11. Why this wins (how it fits the contest)

The hackathon is judged across all tracks together, and the rules point to three things the judges want
to crown. NightDesk is built to hit all three at once:

- **"A complete loop, no human in the middle."** NightDesk runs the entire perceive → decide → check →
  execute → grade cycle autonomously, and makes its zero-human-intervention record visible.
- **Accepted evidence is "trade logs, API activity, *or* user count."** NightDesk guarantees the first
  two outright — reproducible signed trade logs and logged integration activity — so it does not depend
  on a popularity number it cannot control.
- **"May become foundational infrastructure of the Agentic Trading era."** This is the heart of the
  pitch: NightDesk is the **safety gate other agents pass through**, plus an open-source execution
  simulator any team can plug in. It is the layer the whole tokenized-stock era needs, whether or not
  anyone else has adopted it yet.

It also fits each individual track cleanly: the autonomous loop (Trading Agent), the certification +
firewall + simulator + signed audit trail (Trading Infrastructure), and the real-stock fair-value
anchor for tokenized stocks (US Stock AI Trading).

---

## 12. Status — what is done, and what needs a human

- **Done and working:** the real-stock anchor and true-gap measurement; read-only Bitget data; the
  24/7 recorder that builds the evidence base; the open-source fill simulator; the news/macro
  perception and stand-down logic; the multi-seat AI panel; memory and reflection; the 15 risk gates;
  the signed, tamper-proof logbook; the honest backtest with all its controls; the safety certificates
  and firewall; the full evidence pack; and a clean build with all tests passing.
- **Grows over time on its own:** the out-of-sample session bank keeps accumulating as more market
  sessions are recorded.
- **Needs a human's hands (not code):** publishing the public code repository, hosting the public
  dashboard, posting the live results to social channels, recording the demo video, and — optionally —
  one real, tiny live trade once a trade-enabled key and a small amount of funds are provided.

---

## 13. One-line pitch

> NightDesk is the autonomous fair-value and safety gateway for Bitget's tokenized US stocks: it
> reveals the true price gap the perp hides, explains whether each gap is noise or real news, stands
> down or trades the convergence behind 15 hard risk gates, and signs and grades every decision —
> a complete loop with no human in the middle, and every number replayable. It does not promise easy
> profit; it proves it can be trusted.
