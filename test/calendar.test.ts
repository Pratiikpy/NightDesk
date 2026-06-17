// NYSE calendar golden-regression tests — the receipt for the session-logic bug fix.
// Our entire thesis ("the NYSE is closed, so the price is stale") depends on calling sessions
// correctly: holidays, early closes, and DST. These pin the behaviour so it can never silently
// regress. ET times in comments; UTC instants chosen to exercise EDT (UTC-4) and EST (UTC-5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionFor } from "../src/orchestrator/session";

const at = (iso: string) => sessionFor(Date.parse(iso));

test("full-day NYSE closures are HOLIDAY (not a trading day)", () => {
  assert.equal(at("2026-01-01T18:00:00Z").phase, "HOLIDAY"); // New Year (Thu, EST 13:00 ET)
  assert.equal(at("2026-04-03T17:00:00Z").phase, "HOLIDAY"); // Good Friday (EDT 13:00 ET)
  assert.equal(at("2026-06-19T17:00:00Z").phase, "HOLIDAY"); // Juneteenth (Fri) — inside the hackathon window
  assert.equal(at("2026-07-03T17:00:00Z").phase, "HOLIDAY"); // Independence Day observed (Jul 4 is Sat)
  assert.equal(at("2026-11-26T18:00:00Z").phase, "HOLIDAY"); // Thanksgiving (EST)
  assert.equal(at("2026-12-25T18:00:00Z").phase, "HOLIDAY"); // Christmas (EST)
});

test("early-close days end RTH at 13:00 ET", () => {
  // July 2 2026 (Thu, EDT): 12:30 ET open, 13:30 ET closed.
  assert.equal(at("2026-07-02T16:30:00Z").phase, "STAND_DOWN"); // 12:30 ET
  assert.notEqual(at("2026-07-02T17:30:00Z").phase, "STAND_DOWN"); // 13:30 ET → closed early
  // Black Friday Nov 27 2026 (EST): 12:30 ET open, 13:30 ET closed.
  assert.equal(at("2026-11-27T17:30:00Z").phase, "STAND_DOWN"); // 12:30 ET
  assert.notEqual(at("2026-11-27T18:30:00Z").phase, "STAND_DOWN"); // 13:30 ET
  // Christmas Eve Dec 24 2026 (EST).
  assert.equal(at("2026-12-24T17:30:00Z").phase, "STAND_DOWN"); // 12:30 ET
  assert.notEqual(at("2026-12-24T18:30:00Z").phase, "STAND_DOWN"); // 13:30 ET
});

test("DST boundaries: ET offset flips EST↔EDT at the right weeks", () => {
  // Spring: before 2nd Sun Mar (Mar 8) = EST (UTC-5); after = EDT (UTC-4). Same 12:00 UTC instant:
  assert.equal(at("2026-03-01T12:00:00Z").etHour, 7); // EST → 07:00 ET
  assert.equal(at("2026-03-15T12:00:00Z").etHour, 8); // EDT → 08:00 ET
  // Fall: before 1st Sun Nov (Nov 1) = EDT; after = EST.
  assert.equal(at("2026-10-15T12:00:00Z").etHour, 8); // EDT
  assert.equal(at("2026-11-15T12:00:00Z").etHour, 7); // EST
});

test("a normal weekday is open 09:30–16:00 ET", () => {
  const s = at("2026-06-16T14:00:00Z"); // Tue, EDT → 10:00 ET
  assert.equal(s.phase, "STAND_DOWN");
  assert.equal(s.isHoliday, false);
  assert.equal(s.newTradesAllowed, false); // RTH stand-down: no new entries
  assert.equal(at("2026-06-16T21:00:00Z").phase, "EARNINGS_SPRINT"); // 17:00 ET, after the close
});
