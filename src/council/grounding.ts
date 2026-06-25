import { createHash } from "node:crypto";
import type { EventCard } from "../perception/eventcard";
import type { CouncilContext } from "./prompts";

export type EvidenceValue = string | number | boolean;

export interface CouncilEvidenceFact {
  id: string;
  kind: "market" | "event" | "memory" | "context";
  value: EvidenceValue;
  source: string;
  observedAt: number;
  expiresAt: number;
  hash: string;
}

export interface GroundingReport {
  grounded: boolean;
  citations: string[];
  failures: string[];
  activeFactIds: string[];
}

function hashFact(fact: Omit<CouncilEvidenceFact, "hash">): string {
  return createHash("sha256").update(JSON.stringify(fact)).digest("hex");
}

function fact(id: string, kind: CouncilEvidenceFact["kind"], value: EvidenceValue, source: string, observedAt: number, ttlMs: number): CouncilEvidenceFact {
  const base = { id, kind, value, source, observedAt, expiresAt: observedAt + ttlMs };
  return { ...base, hash: hashFact(base) };
}

export function buildCouncilEvidence(card: EventCard, ctx: CouncilContext, ttlMs = 300_000): CouncilEvidenceFact[] {
  const observedAt = card.ts;
  const facts: CouncilEvidenceFact[] = [
    fact("event:magnitude_pct", "event", card.magnitudeEst, card.sources.join("|") || "event-card", observedAt, ttlMs),
    fact("event:confidence", "event", card.confidence, "event-card", observedAt, ttlMs),
    fact("event:direction", "event", card.directionHint, "event-card", observedAt, ttlMs),
    fact("event:half_life_min", "event", card.halfLifeMin, "event-card", observedAt, ttlMs),
  ];
  if (ctx.price != null) facts.push(fact("market:price", "market", ctx.price, "market-truth", observedAt, ttlMs));
  if (ctx.fairValue != null) facts.push(fact("market:fair_value", "market", ctx.fairValue, "market-truth", observedAt, ttlMs));
  if (ctx.premiumPct != null) facts.push(fact("market:premium_pct", "market", ctx.premiumPct, "market-truth", observedAt, ttlMs));
  if (ctx.pegState) facts.push(fact("market:peg_state", "market", ctx.pegState, "market-truth", observedAt, ttlMs));
  if (ctx.memoryPrior) facts.push(fact("memory:prior", "memory", ctx.memoryPrior.slice(0, 500), "graded-memory", observedAt, 86_400_000));
  if (ctx.notes) facts.push(fact("context:notes", "context", ctx.notes.slice(0, 500), "bounded-context", observedAt, ttlMs));
  return facts;
}

export function renderEvidenceFacts(facts: CouncilEvidenceFact[], asOf: number): string {
  return facts
    .filter((item) => item.observedAt <= asOf && item.expiresAt >= asOf)
    .map((item) => JSON.stringify({ id: item.id, kind: item.kind, value: item.value, source: item.source, observedAt: item.observedAt, expiresAt: item.expiresAt, hash: item.hash }))
    .join("\n");
}

export function validateGroundedTrade(input: Record<string, unknown>, card: EventCard, facts: CouncilEvidenceFact[], asOf = card.ts): GroundingReport {
  const active = facts.filter((item) => item.observedAt <= asOf && item.expiresAt >= asOf);
  const activeIds = new Set(active.map((item) => item.id));
  const citations = Array.isArray(input.citations) ? input.citations.map(String) : [];
  const failures: string[] = [];
  if (citations.length < 2) failures.push("at least two evidence citations required");
  for (const citation of citations) if (!activeIds.has(citation)) failures.push(`unknown or expired citation: ${citation}`);
  if (!citations.includes("event:magnitude_pct")) failures.push("event magnitude citation required");
  if (!citations.some((citation) => citation === "market:premium_pct" || citation === "market:price" || citation === "market:fair_value")) failures.push("market fact citation required");

  const side = input.side === "sell" ? "sell" : input.side === "buy" ? "buy" : null;
  const expectedSide = card.directionHint === "long" ? "buy" : card.directionHint === "short" ? "sell" : null;
  if (!side || !expectedSide || side !== expectedSide) failures.push("trade side conflicts with grounded event direction");
  const edge = Number(input.expectedEdgePct);
  if (!Number.isFinite(edge) || edge < 0 || edge > card.magnitudeEst * 1.25 + 1e-9) failures.push("expected edge exceeds grounded event magnitude");
  const size = Number(input.sizePct);
  if (!Number.isFinite(size) || size <= 0) failures.push("size must be finite and positive");
  if (input.entryBand != null) {
    if (!Array.isArray(input.entryBand) || input.entryBand.length !== 2 || !input.entryBand.every((value) => Number.isFinite(Number(value)))) failures.push("entry band must contain two finite prices");
  }
  return { grounded: failures.length === 0, citations, failures, activeFactIds: [...activeIds].sort() };
}
