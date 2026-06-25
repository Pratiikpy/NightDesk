import type { DataQuality, ProvenanceEvent } from "./provenance";

export interface SourceQualityPolicy {
  source: string;
  reliability: number;
  maxEffectiveAgeMs: number;
}

export interface SequenceGap {
  stream: string;
  expected: number;
  actual: number;
  eventId: string;
}

function statusRank(status: DataQuality["status"]): number {
  return status === "valid" ? 0 : status === "degraded" ? 1 : 2;
}

function mergeQuality(base: DataQuality, status: DataQuality["status"], score: number, reasons: string[]): DataQuality {
  return {
    status: statusRank(status) > statusRank(base.status) ? status : base.status,
    score: Math.max(0, Math.min(base.score, score)),
    reasons: [...new Set([...base.reasons, ...reasons])],
    ruleVersion: base.ruleVersion ?? "nightdesk.quality.v1",
  };
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function quoteQuality(payload: unknown): { status: DataQuality["status"]; score: number; reasons: string[] } {
  const row = payload as Record<string, unknown>;
  const bid = numeric(row?.bid);
  const ask = numeric(row?.ask);
  const last = numeric(row?.last);
  if ([bid, ask, last].filter((value) => value != null && value > 0).length === 0) {
    return { status: "quarantined", score: 0, reasons: ["no_positive_price"] };
  }
  if (bid != null && ask != null && bid > ask) {
    return { status: "quarantined", score: 0, reasons: ["crossed_quote"] };
  }
  if (bid == null || ask == null) return { status: "degraded", score: 0.6, reasons: ["one_sided_quote"] };
  return { status: "valid", score: 1, reasons: [] };
}

function bookQuality(payload: unknown): { status: DataQuality["status"]; score: number; reasons: string[] } {
  const row = payload as { bids?: [number, number][]; asks?: [number, number][] };
  const bids = Array.isArray(row?.bids) ? row.bids : [];
  const asks = Array.isArray(row?.asks) ? row.asks : [];
  if (!bids.length || !asks.length) return { status: "degraded", score: 0.4, reasons: ["empty_or_one_sided_book"] };
  const bestBid = numeric(bids[0]?.[0]);
  const bestAsk = numeric(asks[0]?.[0]);
  if (bestBid == null || bestAsk == null || bestBid <= 0 || bestAsk <= 0) {
    return { status: "quarantined", score: 0, reasons: ["invalid_book_price"] };
  }
  if (bestBid > bestAsk) return { status: "quarantined", score: 0, reasons: ["crossed_book"] };
  return { status: "valid", score: 1, reasons: [] };
}

function equityQuoteQuality(payload: unknown): { status: DataQuality["status"]; score: number; reasons: string[] } {
  const row = payload as Record<string, unknown>;
  const value = numeric(row?.price) ?? numeric(row?.last);
  if (value == null || value <= 0) return { status: "quarantined", score: 0, reasons: ["invalid_equity_price"] };
  return { status: "valid", score: 1, reasons: [] };
}

export class DataQualityEngine {
  private readonly policies = new Map<string, SourceQualityPolicy>();
  private readonly sequences = new Map<string, number>();
  private readonly detectedGaps: SequenceGap[] = [];

  constructor(policies: SourceQualityPolicy[]) {
    for (const policy of policies) {
      if (!Number.isFinite(policy.reliability) || policy.reliability < 0 || policy.reliability > 1) {
        throw new Error(`invalid reliability for ${policy.source}`);
      }
      if (!Number.isFinite(policy.maxEffectiveAgeMs) || policy.maxEffectiveAgeMs < 0) {
        throw new Error(`invalid maxEffectiveAgeMs for ${policy.source}`);
      }
      this.policies.set(policy.source, policy);
    }
  }

  gaps(): SequenceGap[] {
    return this.detectedGaps.map((gap) => ({ ...gap }));
  }

  assess<T>(event: ProvenanceEvent<T>): ProvenanceEvent<T> {
    let quality = event.quality;
    const policy = this.policies.get(event.source);
    if (!policy) {
      quality = mergeQuality(quality, "degraded", 0.5, ["unregistered_source"]);
    } else {
      quality = mergeQuality(quality, "valid", policy.reliability, []);
      const age = event.receivedAt - event.effectiveAt;
      if (age > policy.maxEffectiveAgeMs) quality = mergeQuality(quality, "degraded", 0.4, ["effective_data_stale"]);
    }

    if (event.kind === "market.quote") {
      const result = quoteQuality(event.payload);
      quality = mergeQuality(quality, result.status, result.score, result.reasons);
    } else if (event.kind === "equity.quote") {
      const result = equityQuoteQuality(event.payload);
      quality = mergeQuality(quality, result.status, result.score, result.reasons);
    } else if (event.kind === "market.book") {
      const result = bookQuality(event.payload);
      quality = mergeQuality(quality, result.status, result.score, result.reasons);
    }

    if (event.sequence != null) {
      const stream = `${event.source}|${event.kind}|${event.instrument ?? "_"}`;
      const previous = this.sequences.get(stream);
      if (previous != null && event.sequence <= previous) {
        quality = mergeQuality(quality, "quarantined", 0, ["sequence_regression"]);
      } else if (previous != null && event.sequence > previous + 1) {
        this.detectedGaps.push({ stream, expected: previous + 1, actual: event.sequence, eventId: event.eventId });
        quality = mergeQuality(quality, "degraded", 0.5, ["sequence_gap"]);
      }
      if (previous == null || event.sequence > previous) this.sequences.set(stream, event.sequence);
    }

    return { ...event, quality };
  }
}

export interface NumericSourceObservation {
  source: string;
  value: number;
  qualityScore: number;
}

export interface NumericConsensus {
  status: "consensus" | "contradiction" | "insufficient";
  value: number | null;
  maxDeviationPct: number | null;
  sources: string[];
}

export function resolveNumericConsensus(observations: NumericSourceObservation[], maxDeviationPct: number): NumericConsensus {
  const valid = observations.filter(
    (row) => Number.isFinite(row.value) && row.value > 0 && Number.isFinite(row.qualityScore) && row.qualityScore > 0,
  );
  if (valid.length < 2) return { status: "insufficient", value: null, maxDeviationPct: null, sources: valid.map((row) => row.source) };
  const totalWeight = valid.reduce((sum, row) => sum + row.qualityScore, 0);
  const value = valid.reduce((sum, row) => sum + row.value * row.qualityScore, 0) / totalWeight;
  const maxDeviation = Math.max(...valid.map((row) => (Math.abs(row.value - value) / value) * 100));
  return {
    status: maxDeviation <= maxDeviationPct ? "consensus" : "contradiction",
    value: maxDeviation <= maxDeviationPct ? value : null,
    maxDeviationPct: maxDeviation,
    sources: valid.map((row) => row.source),
  };
}
