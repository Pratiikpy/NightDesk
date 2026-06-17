// Perception providers — pluggable sources for news/macro/sentiment EventCards.
// The Bitget Skill Hub skills (news-briefing, macro-analyst, sentiment-analyst, technical-
// analysis, market-intel) are agent-format skills surfaced via the market-data MCP; wiring a
// live adapter is a later milestone. For now the basis generator (eventcard.ts) is the primary,
// fully-deterministic source, and providers default to a null implementation.
import type { EventCard } from "./eventcard";

export interface PerceptionContext {
  phase: string;
  ts: number;
}

export interface PerceptionProvider {
  readonly name: string;
  poll(ctx: PerceptionContext): Promise<EventCard[]>;
}

/** No-op provider — safe default until live Skill Hub adapters are wired. */
export class NullPerceptionProvider implements PerceptionProvider {
  readonly name = "null";
  async poll(): Promise<EventCard[]> {
    return [];
  }
}

/** Test/replay provider that emits a fixed set of cards. */
export class StaticPerceptionProvider implements PerceptionProvider {
  readonly name: string;
  private cards: EventCard[];
  constructor(name: string, cards: EventCard[]) {
    this.name = name;
    this.cards = cards;
  }
  async poll(): Promise<EventCard[]> {
    return this.cards;
  }
}

/** Run all providers concurrently; failures are swallowed (a dead source never blocks the loop). */
export async function pollAll(providers: PerceptionProvider[], ctx: PerceptionContext): Promise<EventCard[]> {
  const settled = await Promise.allSettled(providers.map((p) => p.poll(ctx)));
  return settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
}
