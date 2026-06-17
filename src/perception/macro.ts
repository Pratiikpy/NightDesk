// SoSoValue macro-events client — the economic calendar (FOMC / CPI / Nonfarm Payrolls / PCE …)
// used for EVENT-AWARE ABSTENTION: on a high-severity macro day, an off-hours dislocation may be
// real repricing, not a fade-able liquidity gap — so the desk stands down.
// GET /macro/events, header `x-soso-api-key`. Pure parser + severity are unit-tested; the fetch is
// network-guarded (returns [] on any failure, never throws into the loop).

const BASE = "https://openapi.sosovalue.com/openapi/v1";

export interface MacroEvent {
  date: string; // YYYY-MM-DD
  events: string[];
}
export type Severity = "high" | "medium" | "low";

export function sosoApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.SOSOVALUE_API_KEY || "";
}

/** Pure parser. Accepts the raw array or a {data:[...]} envelope (SoSoValue response format). */
export function parseMacroEvents(json: unknown): MacroEvent[] {
  const arr = Array.isArray(json) ? json : Array.isArray((json as any)?.data) ? (json as any).data : [];
  const out: MacroEvent[] = [];
  for (const x of arr as any[]) {
    if (x && typeof x.date === "string" && Array.isArray(x.events)) {
      out.push({ date: x.date, events: x.events.filter((e: unknown): e is string => typeof e === "string") });
    }
  }
  return out;
}

const HIGH = [/fomc/i, /rate decision/i, /interest rate/i, /\bcpi\b/i, /nonfarm/i, /\bnfp\b/i, /\bpce\b/i, /\bgdp\b/i, /unemployment/i, /\bfed\b/i, /powell/i];
const MEDIUM = [/\bppi\b/i, /retail sales/i, /jobless/i, /payroll/i, /consumer confidence/i, /\bism\b/i, /durable goods/i];

export function eventSeverity(name: string): Severity {
  if (HIGH.some((r) => r.test(name))) return "high";
  if (MEDIUM.some((r) => r.test(name))) return "medium";
  return "low";
}

const rank = (s: Severity): number => (s === "high" ? 3 : s === "medium" ? 2 : 1);

export interface MacroWindow {
  active: boolean; // true only on a HIGH-severity macro day → abstain
  date: string;
  events: string[];
  severity: Severity;
  summary: string;
}

/** NYSE-ET calendar date for a timestamp (June = EDT, UTC-4). */
function etDate(ms: number): string {
  return new Date(ms - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Is the timestamp's ET date a macro-event day, and how severe? */
export function macroWindowFor(events: MacroEvent[], nowMs: number = Date.now()): MacroWindow {
  const date = etDate(nowMs);
  const today = events.find((e) => e.date === date);
  if (!today || today.events.length === 0) {
    return { active: false, date, events: [], severity: "low", summary: `no macro events ${date}` };
  }
  const severity = today.events.map(eventSeverity).sort((a, b) => rank(b) - rank(a))[0] ?? "low";
  return {
    active: severity === "high",
    date,
    events: today.events,
    severity,
    summary: `${date}: ${today.events.join(", ")} (severity ${severity})`,
  };
}

/** Fetch the macro calendar. Network-guarded — returns [] on any failure. */
export async function fetchMacroEvents(apiKey: string = sosoApiKeyFromEnv()): Promise<MacroEvent[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch(`${BASE}/macro/events`, {
      headers: { "x-soso-api-key": apiKey },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    return parseMacroEvents(await res.json());
  } catch {
    return [];
  }
}
