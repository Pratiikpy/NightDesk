import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PointInTimeStore } from "./point-in-time-store";
import type { ProvenanceEvent } from "./provenance";

const DATA = join(process.cwd(), "data", "normalized");
const OUT = join(process.cwd(), "evidence", "data-platform");

interface StreamCoverage {
  stream: string;
  source: string;
  kind: string;
  instrument: string;
  events: number;
  valid: number;
  degraded: number;
  quarantined: number;
  firstReceivedAt: number;
  lastReceivedAt: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  cadenceGaps: number;
  estimatedMissingIntervals: number;
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))]!;
}

export function calculateCoverage(events: ProvenanceEvent[], expectedIntervalMs = 300_000): StreamCoverage[] {
  const groups = new Map<string, ProvenanceEvent[]>();
  for (const event of events) {
    const stream = `${event.source}|${event.kind}|${event.instrument ?? "_"}`;
    const rows = groups.get(stream) ?? [];
    rows.push(event);
    groups.set(stream, rows);
  }
  return [...groups.entries()].map(([stream, rows]) => {
    rows.sort((a, b) => a.receivedAt - b.receivedAt || a.eventId.localeCompare(b.eventId));
    const latencies = rows.map((row) => Math.max(0, row.receivedAt - row.effectiveAt));
    let cadenceGaps = 0;
    let estimatedMissingIntervals = 0;
    for (let index = 1; index < rows.length; index++) {
      const delta = rows[index]!.receivedAt - rows[index - 1]!.receivedAt;
      if (delta > expectedIntervalMs * 1.5) {
        cadenceGaps++;
        estimatedMissingIntervals += Math.max(1, Math.floor(delta / expectedIntervalMs) - 1);
      }
    }
    const [source, kind, instrument] = stream.split("|");
    return {
      stream,
      source: source!,
      kind: kind!,
      instrument: instrument!,
      events: rows.length,
      valid: rows.filter((row) => row.quality.status === "valid").length,
      degraded: rows.filter((row) => row.quality.status === "degraded").length,
      quarantined: rows.filter((row) => row.quality.status === "quarantined").length,
      firstReceivedAt: rows[0]!.receivedAt,
      lastReceivedAt: rows.at(-1)!.receivedAt,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      maxLatencyMs: Math.max(...latencies),
      cadenceGaps,
      estimatedMissingIntervals,
    };
  }).sort((a, b) => a.stream.localeCompare(b.stream));
}

export function runDataCoverage(): Record<string, unknown> {
  mkdirSync(OUT, { recursive: true });
  const events = existsSync(DATA)
    ? new PointInTimeStore(DATA).replay({ asOfReceivedAt: Number.MAX_SAFE_INTEGER, includeQuarantined: true })
    : [];
  const streams = calculateCoverage(events);
  const latestEvents = new Map<string, ProvenanceEvent>();
  for (const event of events) {
    const stream = `${event.source}|${event.kind}|${event.instrument ?? "_"}`;
    const prior = latestEvents.get(stream);
    if (!prior || event.receivedAt > prior.receivedAt || (event.receivedAt === prior.receivedAt && event.eventId > prior.eventId)) latestEvents.set(stream, event);
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    schemaVersion: "nightdesk.data.v1",
    events: events.length,
    streamCount: streams.length,
    instruments: new Set(events.map((event) => event.instrument).filter(Boolean)).size,
    sources: new Set(events.map((event) => event.source)).size,
    kinds: new Set(events.map((event) => event.kind)).size,
    valid: events.filter((event) => event.quality.status === "valid").length,
    degraded: events.filter((event) => event.quality.status === "degraded").length,
    quarantined: events.filter((event) => event.quality.status === "quarantined").length,
    latestValidStreams: [...latestEvents.values()].filter((event) => event.quality.status === "valid").length,
    latestDegradedStreams: [...latestEvents.values()].filter((event) => event.quality.status === "degraded").length,
    latestQuarantinedStreams: [...latestEvents.values()].filter((event) => event.quality.status === "quarantined").length,
    cadenceGaps: streams.reduce((sum, stream) => sum + stream.cadenceGaps, 0),
    estimatedMissingIntervals: streams.reduce((sum, stream) => sum + stream.estimatedMissingIntervals, 0),
    firstReceivedAt: events.length ? Math.min(...events.map((event) => event.receivedAt)) : null,
    lastReceivedAt: events.length ? Math.max(...events.map((event) => event.receivedAt)) : null,
    streams,
  };
  writeFileSync(join(OUT, "coverage.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const headers = ["stream", "source", "kind", "instrument", "events", "valid", "degraded", "quarantined", "firstReceivedAt", "lastReceivedAt", "p50LatencyMs", "p95LatencyMs", "maxLatencyMs", "cadenceGaps", "estimatedMissingIntervals"] as const;
  writeFileSync(join(OUT, "coverage.csv"), [headers.join(","), ...streams.map((row) => headers.map((header) => JSON.stringify(row[header])).join(","))].join("\n") + "\n");
  writeFileSync(
    join(OUT, "coverage-report.md"),
    [
      "# Normalized Data Coverage",
      "",
      `- Events: ${summary.events}`,
      `- Streams: ${summary.streamCount}`,
      `- Instruments: ${summary.instruments}`,
      `- Sources: ${summary.sources}`,
      `- Data kinds: ${summary.kinds}`,
      `- Valid / degraded / quarantined: ${summary.valid} / ${summary.degraded} / ${summary.quarantined}`,
      `- Latest valid / degraded / quarantined streams: ${summary.latestValidStreams} / ${summary.latestDegradedStreams} / ${summary.latestQuarantinedStreams}`,
      `- Cadence gaps: ${summary.cadenceGaps}`,
      `- Estimated missing intervals: ${summary.estimatedMissingIntervals}`,
      "",
      "Coverage is descriptive, not a claim of completeness. Gap counts become meaningful as the",
      "append-only recorder accumulates multiple observations per stream.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK DATA COVERAGE: events=${summary.events} streams=${summary.streamCount} instruments=${summary.instruments}`);
  return summary;
}

if (process.argv[1]?.endsWith("coverage.ts")) runDataCoverage();
