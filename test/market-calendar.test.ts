import test from "node:test";
import assert from "node:assert/strict";
import { easternClock, exchangeDay, standardClosures, standardEarlyCloses } from "../src/data/market-calendar";
import { sessionFor } from "../src/orchestrator/session";

test("exchange calendar generates standard closures through the one-year horizon", () => {
  const closures2027 = standardClosures(2027);
  assert.equal(closures2027.get("2027-07-05"), "Independence Day");
  assert.equal(closures2027.get("2027-03-26"), "Good Friday");
  assert.equal(closures2027.get("2027-11-25"), "Thanksgiving Day");
  assert.equal(exchangeDay("2027-07-05").state, "holiday");
});

test("exchange calendar computes early closes and supports exceptional overrides", () => {
  const early2026 = standardEarlyCloses(2026);
  assert.equal(early2026.get("2026-07-02"), "Day before Independence Day closure");
  assert.equal(exchangeDay("2026-11-27").regularCloseMinute, 780);
  assert.equal(exchangeDay("2027-02-09", { closures: { "2027-02-09": "Exceptional closure" } }).state, "holiday");
});

test("eastern clock uses timezone database across DST", () => {
  assert.deepEqual(easternClock(Date.parse("2026-01-15T15:00:00Z")), { date: "2026-01-15", weekday: 4, hour: 10, minute: 0 });
  assert.deepEqual(easternClock(Date.parse("2026-06-15T14:00:00Z")), { date: "2026-06-15", weekday: 1, hour: 10, minute: 0 });
});

test("session state uses generated 2027 closures instead of a fixed date table", () => {
  const holiday = sessionFor(Date.parse("2027-07-05T15:00:00Z"));
  assert.equal(holiday.phase, "HOLIDAY");
  assert.equal(holiday.newTradesAllowed, true);
});
