export type ExchangeDayState = "weekend" | "holiday" | "regular" | "early_close";

export interface ExchangeDay {
  date: string;
  state: ExchangeDayState;
  regularOpenMinute: number;
  regularCloseMinute: number;
  reason: string | null;
}

export interface CalendarOverrides {
  closures?: Record<string, string>;
  earlyCloses?: Record<string, string>;
}

const pad = (value: number): string => String(value).padStart(2, "0");
const key = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

function utcDate(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function addDays(date: string, days: number): string {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return utcDate(date).getUTCDay();
}

function nthWeekday(year: number, month: number, wantedWeekday: number, ordinal: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const day = 1 + ((wantedWeekday - first.getUTCDay() + 7) % 7) + (ordinal - 1) * 7;
  return key(year, month, day);
}

function lastWeekday(year: number, month: number, wantedWeekday: number): string {
  const last = new Date(Date.UTC(year, month, 0, 12));
  const day = last.getUTCDate() - ((last.getUTCDay() - wantedWeekday + 7) % 7);
  return key(year, month, day);
}

function observed(date: string): string {
  const day = weekday(date);
  if (day === 6) return addDays(date, -1);
  if (day === 0) return addDays(date, 1);
  return date;
}

// Anonymous Gregorian computus. The exchange observes Good Friday two days before Easter Sunday.
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return key(year, month, day);
}

export function standardClosures(year: number): Map<string, string> {
  const closures = new Map<string, string>();
  closures.set(observed(key(year, 1, 1)), "New Year's Day");
  closures.set(nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day");
  closures.set(nthWeekday(year, 2, 1, 3), "Washington's Birthday");
  closures.set(addDays(easterSunday(year), -2), "Good Friday");
  closures.set(lastWeekday(year, 5, 1), "Memorial Day");
  closures.set(observed(key(year, 6, 19)), "Juneteenth National Independence Day");
  closures.set(observed(key(year, 7, 4)), "Independence Day");
  closures.set(nthWeekday(year, 9, 1, 1), "Labor Day");
  closures.set(nthWeekday(year, 11, 4, 4), "Thanksgiving Day");
  closures.set(observed(key(year, 12, 25)), "Christmas Day");
  return closures;
}

function previousTradingDay(date: string, closures: Map<string, string>): string {
  let cursor = addDays(date, -1);
  while (weekday(cursor) === 0 || weekday(cursor) === 6 || closures.has(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

export function standardEarlyCloses(year: number, closures = standardClosures(year)): Map<string, string> {
  const early = new Map<string, string>();
  const independenceClosure = observed(key(year, 7, 4));
  early.set(previousTradingDay(independenceClosure, closures), "Day before Independence Day closure");
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const friday = addDays(thanksgiving, 1);
  if (!closures.has(friday) && ![0, 6].includes(weekday(friday))) early.set(friday, "Day after Thanksgiving");
  const christmasEve = key(year, 12, 24);
  if (!closures.has(christmasEve) && ![0, 6].includes(weekday(christmasEve))) early.set(christmasEve, "Christmas Eve");
  return early;
}

export function exchangeDay(date: string, overrides: CalendarOverrides = {}): ExchangeDay {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(utcDate(date).getTime())) throw new Error(`invalid exchange date: ${date}`);
  const day = weekday(date);
  if (day === 0 || day === 6) return { date, state: "weekend", regularOpenMinute: 570, regularCloseMinute: 0, reason: "Weekend" };
  const year = Number(date.slice(0, 4));
  const closures = standardClosures(year);
  for (const [overrideDate, reason] of Object.entries(overrides.closures ?? {})) closures.set(overrideDate, reason);
  if (closures.has(date)) return { date, state: "holiday", regularOpenMinute: 570, regularCloseMinute: 0, reason: closures.get(date)! };
  const early = standardEarlyCloses(year, closures);
  for (const [overrideDate, reason] of Object.entries(overrides.earlyCloses ?? {})) early.set(overrideDate, reason);
  if (early.has(date)) return { date, state: "early_close", regularOpenMinute: 570, regularCloseMinute: 780, reason: early.get(date)! };
  return { date, state: "regular", regularOpenMinute: 570, regularCloseMinute: 960, reason: null };
}

export interface EasternClock {
  date: string;
  weekday: number;
  hour: number;
  minute: number;
}

export function easternClock(ms: number): EasternClock {
  if (!Number.isFinite(ms)) throw new Error("timestamp must be finite");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: weekdayMap[value("weekday")] ?? -1,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}
