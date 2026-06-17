# Calendar Regression Report — NYSE session-logic bug fix

**Date:** 2026-06-16 · **Status:** ✅ fixed + regression-tested (`test/calendar.test.ts`)

## Bug
`sessionFor()` (the NYSE session state machine that the entire fair-value thesis rests on) hardcoded
the Eastern Time offset to **EDT (UTC-4)** and had **no holiday or early-close handling**. It therefore
treated *every* weekday 09:30–16:00 ET as a normal open trading session.

## Impact
NightDesk's core claims are "live NYSE print in market hours, last official close off-hours, grade at
the next open." With the bug:
- **Juneteenth — Friday, June 19, 2026 — is a full NYSE closure that falls inside the hackathon
  judging window.** The old code would have classified it as a normal open session, certified a stale
  weekend-style anchor as *live*, and tried to "grade at an open" that never happens.
- **DST:** any timestamp outside Mar–Nov (EST) would be mis-bucketed by one hour near session edges.
- **Early closes** (1:00 pm ET half-days) would be treated as full sessions until 16:00.

This is precisely the class of boring systems bug that invalidates a safety/fair-value layer.

## Fix (`src/orchestrator/session.ts`, no new dependency)
- **DST-aware ET offset** computed from US rules: EDT (UTC-4) from the 2nd Sunday of March to the 1st
  Sunday of November, otherwise EST (UTC-5).
- **NYSE full-day holidays** (2025–2026) → a distinct `HOLIDAY` phase (closed; no open to grade against).
- **Early-close days** (day after Thanksgiving, Christmas Eve, July 2 2026) → RTH ends 13:00 ET.

The market-calendar libraries (`exchange_calendars` / `pandas_market_calendars`) confirmed the correct
behaviour; they are Python, so the calendar **data** was embedded directly rather than adding a dependency.

## Regression tests (`test/calendar.test.ts`)
| Case | Expected |
|---|---|
| 2026-06-19 Juneteenth | HOLIDAY (closed) |
| 2026-07-03 Independence (observed) | HOLIDAY |
| 2026-04-03 Good Friday | HOLIDAY |
| 2026-11-26 Thanksgiving | HOLIDAY |
| 2026-01-01 New Year / 2026-12-25 Christmas | HOLIDAY |
| 2026-07-02 / 2026-11-27 / 2026-12-24 | early close → RTH ends 13:00 ET |
| DST spring (Mar 1 vs Mar 15) / fall (Oct 15 vs Nov 15) | EST↔EDT offset flips |
| normal weekday | open 09:30–16:00 ET |

All passing. The bug that could have embarrassed us on June 19 is closed and pinned.
