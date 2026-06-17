# NightDesk — Submission Runbook

The winning play for Track 3 (and all-tracks): a **frozen champion + a growing forward
(out-of-sample) paper-trading track record**, then a clean, rules-compliant submission. The rules
rank evidence **live/paper trading > backtest > concept**, and explicitly value **honest
self-assessment over exaggeration** — both of which this play maximizes without needing real capital,
a deployed URL, or a video.

## A. Now → Jun 25: accumulate forward data (the hero artifact)

1. **The champion is LOCKED** at `evidence/alpha-factory/frozen-champion.locked.json`. The forward
   daemon always prefers the locked file, so the forward record stays genuinely out-of-sample.
   Do **not** treat re-fitting as routine — the lock is the guarantee that the forward track record
   is real.
2. **Keep recording every day.** Each new recorded day (`data/snapshots/<day>.jsonl`) recorded *after*
   the freeze becomes a true forward / out-of-sample session. Keep the recorder / OOS daemon running.
3. **Refresh the forward record** (daily or on a schedule): `npm run alpha:paper-daemon`. Watch
   `forwardSessions` climb in `evidence/forward-paper-daemon/daemon-state.json` as Jun 18 → Jun 24
   (Micron earnings) → Jun 25 land. Today FOMC; Jun 24 Micron — both inside the forward window.

> Target by Jun 25: ~7–8 forward sessions, event-anchored (FOMC + Micron), each graded and signed.
> That is the deepest, most credible paper-trading dataset most teams will not have.

## B. Submission day (before Jun 25, 24:00 UTC+8): freeze + sync + push

1. **Freeze the data:** stop the OOS/recorder daemons so the day's snapshot stops growing
   (reproducibility — judges may re-run).
2. **Regenerate the evidence stack:** `npm run judge:max:full`.
3. **Refresh the forward record once more:** `npm run alpha:paper-daemon` (uses the locked champion).
4. **Sync the doc numbers:** `npm run numbers:check`. It prints exactly which figures drifted; update
   them in README.md / SUBMISSION.md until it is clean. Then `npm run docs:check`.
5. **Final audit:** `npm run final:verify` (build, tests, redteam, tamper, docs, secrets).
6. **Push to a PUBLIC GitHub repo** (mandatory — Track 3 requires a public repo with a runnable
   README). Then set `NIGHTDESK_REPO_URL` and re-run `final:verify` for the fresh-clone proof.

## C. Submission form (compliance checklist)

- **Track:** US Stock AI Trading (Track 3). UID must match registration.
- **GitHub repo:** public, runnable from the README (no login). ✓ baseline.
- **Paper-trading log (required/preferred):** link
  `evidence/forward-paper-daemon/live-paper-trading-log.csv` (forward) and
  `evidence/trading-log/nightdesk-paper-trading-log.csv`. Both carry the required schema: timestamp,
  asset, direction, price, quantity, balance change.
- **Thesis (required):** the problem → loop → evidence → modules story is in `README.md` / `PROJECT.md`.
- **At least one verifiable usage record:** ✓ paper logs + `evidence/api-call-log.jsonl`.
- **Backtest (optional):** all reproducible code — never screenshots.
- **Demo video:** optional (the repo is runnable without login). Record one only if it helps; a 3-min
  loop-first video is upside, not a requirement.
- **Community Impact / Participation:** quote the Bitget tweet, tag #BitgetHackathon + @Bitget_AI,
  submit the post link (+50 USDT participation; shot at 500 USDT community award).

## What does NOT block submission (per the rules)

- No deployed URL needed (public repo satisfies Track 3).
- No real capital needed (paper trading is accepted and ranks above backtest).
- No video needed (only required if the demo needs a login).
