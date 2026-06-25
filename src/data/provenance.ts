import { createHash } from "node:crypto";

export const DATA_SCHEMA_VERSION = "nightdesk.data.v1" as const;

export type DataKind =
  | "market.quote"
  | "market.book"
  | "market.trade"
  | "market.funding"
  | "equity.quote"
  | "calendar.session"
  | "corporate.action"
  | "macro.event"
  | "news.item";

export type DataQualityStatus = "valid" | "degraded" | "quarantined";

export interface DataQuality {
  status: DataQualityStatus;
  score: number;
  reasons: string[];
  ruleVersion: "nightdesk.quality.v1";
}

export interface ProvenanceInput<T> {
  eventId: string;
  kind: DataKind;
  source: string;
  instrument?: string;
  effectiveAt: number;
  observedAt: number;
  receivedAt: number;
  sequence?: number;
  quality?: Partial<DataQuality>;
  payload: T;
}

export interface ProvenanceEvent<T = unknown>
  extends Omit<ProvenanceInput<T>, "quality" | "instrument" | "sequence"> {
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  instrument: string | null;
  sequence: number | null;
  quality: DataQuality;
  payloadHash: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export function provenanceHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function finiteTimestamp(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite epoch timestamp`);
}

export function normalizeProvenanceEvent<T>(input: ProvenanceInput<T>): ProvenanceEvent<T> {
  if (!input.eventId.trim()) throw new Error("eventId is required");
  if (!input.source.trim()) throw new Error("source is required");
  finiteTimestamp("effectiveAt", input.effectiveAt);
  finiteTimestamp("observedAt", input.observedAt);
  finiteTimestamp("receivedAt", input.receivedAt);
  if (input.receivedAt < input.observedAt) throw new Error("receivedAt cannot precede observedAt");
  if (input.sequence !== undefined && (!Number.isSafeInteger(input.sequence) || input.sequence < 0)) {
    throw new Error("sequence must be a non-negative safe integer");
  }

  const status = input.quality?.status ?? "valid";
  const score = input.quality?.score ?? (status === "valid" ? 1 : status === "degraded" ? 0.5 : 0);
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("quality.score must be between 0 and 1");

  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    eventId: input.eventId,
    kind: input.kind,
    source: input.source,
    instrument: input.instrument?.toUpperCase() ?? null,
    effectiveAt: input.effectiveAt,
    observedAt: input.observedAt,
    receivedAt: input.receivedAt,
    sequence: input.sequence ?? null,
    quality: {
      status,
      score,
      reasons: [...(input.quality?.reasons ?? [])],
      ruleVersion: "nightdesk.quality.v1",
    },
    payloadHash: provenanceHash(input.payload),
    payload: input.payload,
  };
}

export function eventIdentityHash(event: ProvenanceEvent): string {
  return provenanceHash({
    schemaVersion: event.schemaVersion,
    eventId: event.eventId,
    kind: event.kind,
    source: event.source,
    instrument: event.instrument,
    effectiveAt: event.effectiveAt,
    observedAt: event.observedAt,
    receivedAt: event.receivedAt,
    sequence: event.sequence,
    quality: event.quality,
    payloadHash: event.payloadHash,
  });
}
