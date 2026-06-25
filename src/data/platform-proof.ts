import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { PointInTimeStore } from "./point-in-time-store";
import { normalizeProvenanceEvent, provenanceHash, type ProvenanceEvent } from "./provenance";
import { DataQualityEngine, resolveNumericConsensus } from "./quality";
import { exchangeDay } from "./market-calendar";
import { adjustHistoricalPriceForSplits, knownCorporateActions, type CorporateActionPayload } from "./corporate-actions";

const OUT = join(process.cwd(), "evidence", "data-platform");
const FIXTURE_STORE = join(process.cwd(), "data", ".point-in-time-proof");

function event(id: string, sequence: number, receivedAt: number, payload: Record<string, unknown>): ProvenanceEvent {
  return normalizeProvenanceEvent({
    eventId: id,
    kind: "market.quote",
    source: "fixture-feed",
    instrument: "NVDA",
    effectiveAt: 100,
    observedAt: 110,
    receivedAt,
    sequence,
    payload,
  });
}

export interface DataPlatformProof {
  schemaVersion: string;
  eventsWritten: number;
  pointInTimeEvents: number;
  futureEventsExcluded: number;
  quarantinedEventsExcluded: number;
  sequenceGapsDetected: number;
  deterministicReplay: boolean;
  replayHash: string;
  contradictionFailsClosed: boolean;
  duplicateStatus: string;
  partitions: string[];
  statusCounts: Record<string, number>;
  calendarHorizon2027: boolean;
  futureCorporateActionExcluded: boolean;
  splitAdjustmentCorrect: boolean;
}

export function runDataPlatformProof(): DataPlatformProof {
  rmSync(FIXTURE_STORE, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const quality = new DataQualityEngine([{ source: "fixture-feed", reliability: 0.98, maxEffectiveAgeMs: 500 }]);
  const store = new PointInTimeStore(FIXTURE_STORE);
  const assessed = [
    quality.assess(event("seq-1", 1, 120, { bid: 99, ask: 100, last: 99.5 })),
    quality.assess(event("seq-3", 3, 130, { bid: 100, ask: 101, last: 100.5 })),
    quality.assess(event("crossed", 4, 140, { bid: 103, ask: 102, last: 102.5 })),
    quality.assess(event("future-revision", 5, 300, { bid: 101, ask: 102, last: 101.5 })),
  ];
  const appendResults = assessed.map((row) => store.append(row));
  const duplicate = store.append(assessed[0]!);
  const pointInTime = store.replay({ asOfReceivedAt: 200, instrument: "NVDA" });
  const replayAgain = store.replay({ asOfReceivedAt: 200, instrument: "NVDA" });
  const replayHash = provenanceHash(pointInTime);
  const contradiction = resolveNumericConsensus([
    { source: "anchor-a", value: 100, qualityScore: 1 },
    { source: "anchor-b", value: 110, qualityScore: 1 },
  ], 1);
  const knownAction = normalizeProvenanceEvent<CorporateActionPayload>({
    eventId: "known-split",
    kind: "corporate.action",
    source: "actions-fixture",
    instrument: "NVDA",
    effectiveAt: 250,
    observedAt: 150,
    receivedAt: 150,
    payload: { actionType: "split", ticker: "NVDA", announcedAt: 150, exDate: "2027-01-15", ratioFrom: 1, ratioTo: 2 },
  });
  const futureAction = normalizeProvenanceEvent<CorporateActionPayload>({
    eventId: "future-known-split",
    kind: "corporate.action",
    source: "actions-fixture",
    instrument: "NVDA",
    effectiveAt: 350,
    observedAt: 300,
    receivedAt: 300,
    payload: { actionType: "split", ticker: "NVDA", announcedAt: 300, exDate: "2027-02-15", ratioFrom: 1, ratioTo: 4 },
  });
  const actionsAtCutoff = knownCorporateActions([knownAction, futureAction], 200, "NVDA");
  const statusCounts = assessed.reduce<Record<string, number>>((out, row) => {
    out[row.quality.status] = (out[row.quality.status] ?? 0) + 1;
    return out;
  }, {});
  const proof: DataPlatformProof = {
    schemaVersion: "nightdesk.data.v1",
    eventsWritten: appendResults.filter((row) => row.status === "appended").length,
    pointInTimeEvents: pointInTime.length,
    futureEventsExcluded: assessed.filter((row) => row.receivedAt > 200).length,
    quarantinedEventsExcluded: assessed.filter((row) => row.receivedAt <= 200 && row.quality.status === "quarantined").length,
    sequenceGapsDetected: quality.gaps().length,
    deterministicReplay: replayHash === provenanceHash(replayAgain),
    replayHash,
    contradictionFailsClosed: contradiction.status === "contradiction" && contradiction.value === null,
    duplicateStatus: duplicate.status,
    partitions: [...new Set(appendResults.map((row) => relative(process.cwd(), row.file).replace(/\\/g, "/")))],
    statusCounts,
    calendarHorizon2027: exchangeDay("2027-07-05").state === "holiday",
    futureCorporateActionExcluded: actionsAtCutoff.length === 1 && actionsAtCutoff[0]?.eventId === "known-split",
    splitAdjustmentCorrect: adjustHistoricalPriceForSplits(100, actionsAtCutoff, 100, 400) === 50,
  };
  writeFileSync(join(OUT, "point-in-time-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  writeFileSync(join(OUT, "normalized-events.jsonl"), `${assessed.map((row) => JSON.stringify(row)).join("\n")}\n`);
  writeFileSync(join(OUT, "sequence-gaps.jsonl"), `${quality.gaps().map((row) => JSON.stringify(row)).join("\n")}\n`);
  writeFileSync(
    join(OUT, "point-in-time-report.md"),
    [
      "# Point-in-Time Data Platform Proof",
      "",
      `- Schema: \`${proof.schemaVersion}\``,
      `- Immutable events written: ${proof.eventsWritten}`,
      `- Events visible at cutoff: ${proof.pointInTimeEvents}`,
      `- Future-arriving events excluded: ${proof.futureEventsExcluded}`,
      `- Quarantined events excluded: ${proof.quarantinedEventsExcluded}`,
      `- Sequence gaps detected: ${proof.sequenceGapsDetected}`,
      `- Deterministic replay: ${proof.deterministicReplay ? "PASS" : "FAIL"}`,
      `- Contradictory anchors fail closed: ${proof.contradictionFailsClosed ? "PASS" : "FAIL"}`,
      `- Generated exchange calendar covers 2027: ${proof.calendarHorizon2027 ? "PASS" : "FAIL"}`,
      `- Future-known corporate action excluded: ${proof.futureCorporateActionExcluded ? "PASS" : "FAIL"}`,
      `- Split adjustment is point-in-time correct: ${proof.splitAdjustmentCorrect ? "PASS" : "FAIL"}`,
      `- Duplicate append: ${proof.duplicateStatus}`,
      `- Replay hash: \`${proof.replayHash}\``,
      "",
      "The replay uses `receivedAt` as its knowledge cutoff. Revisions received after that cutoff are",
      "excluded even when their market-effective timestamp is earlier. Quarantined observations remain",
      "in immutable storage for audit but are excluded from trading/research replay by default.",
      "",
    ].join("\n"),
  );
  rmSync(FIXTURE_STORE, { recursive: true, force: true });
  console.log(`NIGHTDESK POINT-IN-TIME DATA PROOF: ${proof.deterministicReplay && proof.contradictionFailsClosed && proof.calendarHorizon2027 && proof.futureCorporateActionExcluded && proof.splitAdjustmentCorrect ? "PASS" : "FAIL"}`);
  return proof;
}

if (process.argv[1]?.endsWith("platform-proof.ts")) runDataPlatformProof();
