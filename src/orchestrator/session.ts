// Session state machine — maps a timestamp to an NYSE market phase (PRD §6).
//
// Correctness matters here above almost anywhere else: the entire thesis is "the NYSE is closed, so
// the price is stale." If we mis-call a session, we certify a stale anchor as live. So this handles:
//   • DST — ET is EDT (UTC-4) from the 2nd Sunday of March to the 1st Sunday of November, else EST (UTC-5).
//   • NYSE holidays — full-day closures (incl. Juneteenth, which falls inside the 2026 hackathon window).
//   • Early closes — 13:00 ET half-days (day after Thanksgiving, Christmas Eve).
import { easternClock, exchangeDay } from "../data/market-calendar";

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

export function sessionFor(ms: number): SessionInfo {
  const et = easternClock(ms);
  const weekday = et.weekday;
  const h = et.hour;
  const m = et.minute;
  const minutes = h * 60 + m;
  const day = exchangeDay(et.date);
  const isWeekend = day.state === "weekend";
  const isHoliday = day.state === "holiday";
  const rthClose = day.regularCloseMinute || 960;

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
