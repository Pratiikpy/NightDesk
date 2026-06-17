// Session state machine — maps a timestamp to an NYSE market phase (PRD §6).
//
// Correctness matters here above almost anywhere else: the entire thesis is "the NYSE is closed, so
// the price is stale." If we mis-call a session, we certify a stale anchor as live. So this handles:
//   • DST — ET is EDT (UTC-4) from the 2nd Sunday of March to the 1st Sunday of November, else EST (UTC-5).
//   • NYSE holidays — full-day closures (incl. Juneteenth, which falls inside the 2026 hackathon window).
//   • Early closes — 13:00 ET half-days (day after Thanksgiving, Christmas Eve).
export type Phase = "WEEKEND" | "HOLIDAY" | "STAND_DOWN" | "EARNINGS_SPRINT" | "OVERNIGHT" | "PRE_OPEN";

export interface SessionInfo {
  phase: Phase;
  etHour: number;
  etMinute: number;
  weekday: number; // 0 Sun .. 6 Sat (ET)
  isWeekend: boolean;
  isHoliday: boolean;
  isPreOpenCutoff: boolean; // 09:25–09:30 ET — flat-by-open trigger
  newTradesAllowed: boolean;
}

// NYSE full-day closures (ET calendar dates), 2025–2026.
const NYSE_HOLIDAYS = new Set<string>([
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
]);
// NYSE 13:00 ET early closes.
const NYSE_EARLY_CLOSE = new Set<string>(["2025-07-03", "2025-11-28", "2025-12-24", "2026-07-02", "2026-11-27", "2026-12-24"]);

/** nth Sunday of a month (UTC), 1-indexed day-of-month. */
function nthSundayUTC(year: number, monthIdx: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, monthIdx, 1)).getUTCDay();
  return ((7 - firstDow) % 7) + 1 + (n - 1) * 7;
}

/** ET UTC-offset (ms) at a given instant — DST-aware (US rules). */
function etOffsetMs(ms: number): number {
  const y = new Date(ms).getUTCFullYear();
  const dstStart = Date.UTC(y, 2, nthSundayUTC(y, 2, 2), 7, 0, 0); // 2nd Sun Mar, 02:00 EST = 07:00 UTC
  const dstEnd = Date.UTC(y, 10, nthSundayUTC(y, 10, 1), 6, 0, 0); // 1st Sun Nov, 02:00 EDT = 06:00 UTC
  const inDst = ms >= dstStart && ms < dstEnd;
  return (inDst ? 4 : 5) * 3600 * 1000;
}

const dateKey = (et: Date): string => et.toISOString().slice(0, 10);

export function sessionFor(ms: number): SessionInfo {
  const et = new Date(ms - etOffsetMs(ms));
  const weekday = et.getUTCDay();
  const h = et.getUTCHours();
  const m = et.getUTCMinutes();
  const minutes = h * 60 + m;
  const isWeekend = weekday === 0 || weekday === 6;
  const key = dateKey(et);
  const isHoliday = !isWeekend && NYSE_HOLIDAYS.has(key);
  const rthClose = NYSE_EARLY_CLOSE.has(key) ? 780 : 960; // 13:00 ET early close vs 16:00

  let phase: Phase;
  if (isWeekend) phase = "WEEKEND";
  else if (isHoliday) phase = "HOLIDAY";
  else if (minutes >= 570 && minutes < rthClose) phase = "STAND_DOWN"; // 09:30–close (RTH)
  else if (minutes >= rthClose && minutes < 1200) phase = "EARNINGS_SPRINT"; // close–20:00
  else if (minutes >= 1200 || minutes < 240) phase = "OVERNIGHT"; // 20:00–04:00
  else phase = "PRE_OPEN"; // 04:00–09:30

  const isPreOpenCutoff = !isWeekend && !isHoliday && minutes >= 565 && minutes < 570; // 09:25–09:30
  // New entries only off-hours (weekend/holiday perp-leg, earnings sprint, overnight). RTH stand-down
  // and the pre-open wind-down take no new positions.
  const newTradesAllowed = phase === "WEEKEND" || phase === "HOLIDAY" || phase === "EARNINGS_SPRINT" || phase === "OVERNIGHT";

  return { phase, etHour: h, etMinute: m, weekday, isWeekend, isHoliday, isPreOpenCutoff, newTradesAllowed };
}
