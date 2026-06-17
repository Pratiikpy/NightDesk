# NightDesk — Frontend & UX Spec

> For the frontend build + designer. Pairs with `PROJECT.md` (which is intentionally UI-free). This
> doc is the *only* place UI/UX lives. It describes screens, structure, and behaviour — not visual
> styling (colours/type are the designer's call; see the brand pointers at the end).

## 0. The one job of this frontend

The audience is a **skeptical trader-judge first**, a potential user/builder second. The frontend has
exactly one job:

> **Tell the story in 30 seconds, and let a judge *prove* it live in 3 minutes.**

Everything below serves that. Design language: a **professional risk/audit desk at night** —
terminal-grade credibility, restraint over hype. The product's whole brand is *trust*, so the UI must
feel verifiable, not flashy.

## 1. Always-on chrome (on every screen)

A persistent top bar carries the trust signals so they are never more than a glance away:

- **`0 human interventions · N nights`** counter — the manifesto, made literal.
- **`Ledger: VERIFIED ✓ (Ed25519)`** live badge (red if tamper detected) — backed by `/api/verify`.
- **Market session state:** `NYSE OPEN` / `CLOSED` / `WEEKEND` — because the product behaves
  differently off-hours (measuring, not trading).
- **Last-updated timestamp** + a subtle "live" pulse.

Numbers everywhere use one consistent format (monospace, +/− colouring, sensible rounding). Never show
a number without a unit or sign.

## 2. The screens (beyond your landing page)

You have the **landing page**. Here is the rest, in priority order.

### 2.1 Live Risk Desk — THE hero screen `(/api/causality)`
The board of all 19 tokenized stocks. For each row: the **true gap vs the real-stock anchor**, the
**perp gap that hides it**, the classified **cause** (noise / news / macro / issuer / perp-illusion /
liquidity-trap), and the **action** (fade / abstain / avoid). The signature visual is the
**two-gauge contrast**: "perp says ~0 dislocations" beside "real stock says 17 of 19 dislocated." This
is the discovery the whole project rests on — it must be the most memorable screen.

### 2.2 The Loop — autonomy in motion `(/api/scorecard + /api/evidence)`
Visualise `perceive → decide → gate → execute → grade` as a live cycle, with the **0-human counter**
front and centre. Show a **real council transcript** (bull → bear → risk debate → verdict), the
**gates firing** (which passed/blocked), and **abstentions** treated as first-class decisions. This is
where "complete loop, no human in the middle" stops being a claim and becomes something a judge watches.

### 2.3 Try the Firewall — the interactive proof `(/api/firewall)`
Let the judge **submit a trade intent** and get back `ALLOW` / `ALLOW-CAPPED` / `REJECT` with the
certificate and the reason. Pre-load a few buttons: a safe buy (ALLOW), an oversized one (ALLOW-CAPPED
with the max safe size), and an unsafe/expired/wrong-ticker one (REJECT). Traffic-light UX. This screen
is what makes NightDesk read as **infrastructure other agents pass through**, not just another bot.

### 2.4 Proof / Evidence — the receipts `(/api/verify + /api/evidence + static evidence)`
The screen built for the skeptic. Lead with the **honest null edge-test** ("we red-teamed our own
thesis and report it failed — here's the receipt") — counter-intuitively, that is the strongest trust
move. Then: live ledger verification, paper-trading logs, the arena ("we lose less"), shadow-gateway
counterfactuals (missed profit *and* blocked loss), and the claim ledger. Everything links to a file a
judge can open. Tagline: *every number replayable.*

### 2.5 Token Quality Board — optional but high-value `(/api/quality)`
An A–D reliability grade per token (tracking / stability / liquidity; legal rights excluded). Useful
even to someone who never lets it trade — answers "which tokenized stocks are actually reliable?"

### 2.6 Alpha Factory / Research Lab — optional
The strategy search, the Overfit Court (rejected configs), and the frozen champion — every PnL number
clearly labelled **in-sample, not a future-alpha claim**. Shows research rigour without overclaiming.

## 3. Cross-cutting UX rules

- **Two modes, clearly signalled:** market-hours vs off-hours. Off-hours, the desk *measures* (quote-only
  for rTokens); say so, don't fake live depth.
- **Honest empty/loading/error states:** rToken L2 books are intermittent (~half live at a time). Show
  "quote-only" gracefully instead of a broken widget.
- **Live refresh cadence:** risk desk ~60s, the rest ~15–20s. Surface freshness, never silently stale.
- **No profit promises anywhere.** In-sample numbers always carry the in-sample label. Restraint is the
  brand.
- **Responsive:** at minimum the landing page and the Risk Desk must work on a phone (judges browse on
  mobile).

## 4. Recommended build order

1. **Live Risk Desk** (the hero — biggest payoff per hour).
2. **Always-on trust chrome** (counter + ledger badge + session state).
3. **Try the Firewall** (the interactive "wow", cheap to build, high impact).
4. **Proof / Evidence** (where skeptics convert).
5. **The Loop** (the autonomy story).
6. Quality Board + Alpha Factory (polish).

## 5. The 90-second judge click-path (design the flow for THIS)

`Landing reveal` → `Risk Desk` (perp says fine; real stock says 17/19 dislocated) → `The Loop`
(0 humans, watch the council debate) → `Try the Firewall` (reject an unsafe trade live) → `Proof`
(the null edge-test + the signed ledger). This mirrors the demo story in `SUBMISSION.md`, so the
product and the pitch reinforce each other.

## 6. Brand pointers (hand to the designer alongside PROJECT.md)

- Vibe: a trader's risk/audit desk **at night** — "NightDesk" is literal. Dark, nocturnal, terminal-grade.
- Hero image: the **perp-vs-real two-gauge reveal**.
- Metaphors: the **loop** (autonomy) and the **gate/traffic-light** (firewall).
- Tone: signed, replayable, honest — never "get rich." Rigor reads as premium; flash reads as cheap.
- Audience: skeptical trader-judges. Credibility > spectacle.
