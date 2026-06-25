import type { Snapshot, PegRow, LegQuote } from "../pegwatch/collect";
import { normalizeProvenanceEvent, type ProvenanceEvent } from "./provenance";
import { DataQualityEngine } from "./quality";

export const DEFAULT_SOURCE_POLICIES = [
  { source: "bitget-spot", reliability: 0.98, maxEffectiveAgeMs: 60_000 },
  { source: "bitget-perp", reliability: 0.98, maxEffectiveAgeMs: 60_000 },
  { source: "equity-anchor", reliability: 0.9, maxEffectiveAgeMs: 4 * 24 * 60 * 60 * 1000 },
] as const;

function sourceTime(sourceTime: number | null | undefined, receivedAt: number): number {
  return sourceTime != null && Number.isFinite(sourceTime) && sourceTime >= 0 ? Math.min(sourceTime, receivedAt) : receivedAt;
}

function quoteEvent(
  row: PegRow,
  leg: LegQuote,
  source: "bitget-spot" | "bitget-perp",
  receivedAt: number,
): ProvenanceEvent {
  const effectiveAt = sourceTime(leg.ts, receivedAt);
  return normalizeProvenanceEvent({
    eventId: `${receivedAt}:${source}:${leg.symbol}:quote`,
    kind: "market.quote",
    source,
    instrument: row.ticker,
    effectiveAt,
    observedAt: receivedAt,
    receivedAt,
    payload: { symbol: leg.symbol, bid: leg.bid, ask: leg.ask, last: leg.last, mid: leg.mid },
  });
}

export function normalizeSnapshot(snapshot: Snapshot, quality = new DataQualityEngine([...DEFAULT_SOURCE_POLICIES])): ProvenanceEvent[] {
  const events: ProvenanceEvent[] = [];
  for (const row of snapshot.rows) {
    if (row.rToken) {
      events.push(quality.assess(quoteEvent(row, row.rToken, "bitget-spot", snapshot.ts)));
      if (row.rToken.book) {
        events.push(
          quality.assess(
            normalizeProvenanceEvent({
              eventId: `${snapshot.ts}:bitget-spot:${row.rToken.symbol}:book`,
              kind: "market.book",
              source: "bitget-spot",
              instrument: row.ticker,
              effectiveAt: sourceTime(row.rToken.ts, snapshot.ts),
              observedAt: snapshot.ts,
              receivedAt: snapshot.ts,
              payload: { symbol: row.rToken.symbol, bids: row.rToken.book.bids, asks: row.rToken.book.asks },
            }),
          ),
        );
      }
    }
    if (row.perp) events.push(quality.assess(quoteEvent(row, row.perp, "bitget-perp", snapshot.ts)));
    if (row.equity) {
      events.push(
        quality.assess(
          normalizeProvenanceEvent({
            eventId: `${snapshot.ts}:equity-anchor:${row.ticker}:quote`,
            kind: "equity.quote",
            source: "equity-anchor",
            instrument: row.ticker,
            effectiveAt: sourceTime(row.equity.asOf, snapshot.ts),
            observedAt: snapshot.ts,
            receivedAt: snapshot.ts,
            payload: {
              symbol: row.ticker,
              bid: null,
              ask: null,
              last: row.equity.price,
              price: row.equity.price,
              previousClose: row.equity.previousClose,
              marketState: row.equity.marketState,
              resolvedSource: row.equity.source ?? "unknown",
              confirmingSources: row.equity.sources ?? [],
              maxDeviationPct: row.equity.maxDeviationPct ?? null,
              qualityStatus: row.equity.qualityStatus ?? "unknown",
            },
          }),
        ),
      );
    }
  }
  return events;
}
