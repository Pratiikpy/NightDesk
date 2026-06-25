import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "data-platform");

interface AuditRow {
  requirement: string;
  passed: boolean;
  evidence: string[];
  detail: string;
}

function json<T>(file: string): T {
  return JSON.parse(readFileSync(join(ROOT, file), "utf8")) as T;
}

export function runMonth2ExitAudit(): { passed: boolean; rows: AuditRow[] } {
  mkdirSync(OUT, { recursive: true });
  const point = json<Record<string, unknown>>("evidence/data-platform/point-in-time-proof.json");
  const stream = json<Record<string, unknown>>("evidence/data-platform/stream-resilience-proof.json");
  const liveStream = json<Record<string, unknown>>("evidence/data-platform/live-stream-smoke.json");
  const anchor = json<Record<string, unknown>>("evidence/data-platform/anchor-redundancy-proof.json");
  const anchorUniverse = json<Record<string, unknown>>("evidence/data-platform/live-anchor-universe.json");
  const coverage = json<Record<string, unknown>>("evidence/data-platform/coverage.json");
  const normalizedEvents = readFileSync(join(ROOT, "evidence/data-platform/normalized-events.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { quality?: { status?: string } });

  const rows: AuditRow[] = [
    {
      requirement: "normalized event store and provenance schema",
      passed: point.schemaVersion === "nightdesk.data.v1" && Number(coverage.events) >= 64 && coverage.instruments === 19,
      evidence: ["evidence/data-platform/point-in-time-proof.json", "evidence/data-platform/coverage.json"],
      detail: `schema=${point.schemaVersion} events=${coverage.events} instruments=${coverage.instruments}`,
    },
    {
      requirement: "raw and normalized immutable dataset partitions",
      passed: existsSync(join(ROOT, "data", "snapshots")) && existsSync(join(ROOT, "data", "normalized")) && point.duplicateStatus === "duplicate",
      evidence: ["data/snapshots", "data/normalized", "evidence/data-platform/point-in-time-report.md"],
      detail: `raw=${existsSync(join(ROOT, "data", "snapshots"))} normalized=${existsSync(join(ROOT, "data", "normalized"))} duplicate=${point.duplicateStatus}`,
    },
    {
      requirement: "generated market calendar and point-in-time corporate actions",
      passed: point.calendarHorizon2027 === true && point.futureCorporateActionExcluded === true && point.splitAdjustmentCorrect === true,
      evidence: ["evidence/data-platform/point-in-time-proof.json"],
      detail: `calendar=${point.calendarHorizon2027} futureActionExcluded=${point.futureCorporateActionExcluded} splitAdjustment=${point.splitAdjustmentCorrect}`,
    },
    {
      requirement: "reliable public stream reconnect, heartbeat, backfill, and gap detection",
      passed: stream.subscriptionSent === true && stream.sequenceGapDetected === true && stream.sequenceRegressionRejected === true && stream.gapBackfillCompleted === true && stream.reconnectBackfillCompleted === true && stream.heartbeatSent === true && stream.circuitOpened === true,
      evidence: ["evidence/data-platform/stream-resilience-proof.json", "evidence/data-platform/stream-resilience-report.md"],
      detail: "deterministic disconnect, gap, recovery, heartbeat, and circuit scenario",
    },
    {
      requirement: "live public ticker and order-book stream receipt",
      passed: liveStream.success === true && liveStream.credentialsUsed === false && liveStream.writesEnabled === false && Array.isArray(liveStream.channels) && (liveStream.channels as string[]).includes("ticker") && (liveStream.channels as string[]).includes("books5"),
      evidence: ["evidence/data-platform/live-stream-smoke.json", "evidence/data-platform/live-stream-records.jsonl"],
      detail: `channels=${Array.isArray(liveStream.channels) ? (liveStream.channels as string[]).join("|") : "none"}`,
    },
    {
      requirement: "equity-anchor redundancy and fail-closed contradictions",
      passed: anchor.consensusTradeable === true && anchor.priceContradictionFailsClosed === true && anchor.marketStateContradictionFailsClosed === true && anchor.singleSourceFailsClosed === true && anchor.staleSourcesFailClosed === true,
      evidence: ["evidence/data-platform/anchor-redundancy-proof.json", "evidence/data-platform/live-anchor-comparison.json"],
      detail: "two fresh sources required; stale, single-source, and contradictory states block",
    },
    {
      requirement: "full-universe live anchor confirmation",
      passed: anchorUniverse.universeSize === 19 && anchorUniverse.consensus === 19 && anchorUniverse.coveragePct === 100 && anchorUniverse.allPairsConfirmed === true,
      evidence: ["evidence/data-platform/live-anchor-universe.json", "evidence/data-platform/live-anchor-universe.csv"],
      detail: `consensus=${anchorUniverse.consensus}/${anchorUniverse.universeSize} coverage=${anchorUniverse.coveragePct}%`,
    },
    {
      requirement: "data-quality quarantine path",
      passed: point.quarantinedEventsExcluded === 1 && normalizedEvents.some((event) => event.quality?.status === "quarantined") && coverage.latestQuarantinedStreams === 0,
      evidence: ["evidence/data-platform/normalized-events.jsonl", "evidence/data-platform/coverage.json"],
      detail: `fixtureExcluded=${point.quarantinedEventsExcluded} latestQuarantinedStreams=${coverage.latestQuarantinedStreams}`,
    },
    {
      requirement: "deterministic historical replay",
      passed: point.deterministicReplay === true && typeof point.replayHash === "string" && /^[a-f0-9]{64}$/.test(point.replayHash as string),
      evidence: ["evidence/data-platform/point-in-time-proof.json"],
      detail: `replayHash=${point.replayHash}`,
    },
    {
      requirement: "point-in-time leakage prevention",
      passed: point.futureEventsExcluded === 1 && point.futureCorporateActionExcluded === true,
      evidence: ["evidence/data-platform/point-in-time-proof.json"],
      detail: `futureEventsExcluded=${point.futureEventsExcluded}`,
    },
    {
      requirement: "coverage, latency, quality, and cadence gaps quantified",
      passed: coverage.streamCount === 64 && coverage.latestValidStreams === 64 && coverage.latestDegradedStreams === 0 && coverage.latestQuarantinedStreams === 0 && Array.isArray(coverage.streams) && (coverage.streams as unknown[]).length === 64,
      evidence: ["evidence/data-platform/coverage.json", "evidence/data-platform/coverage.csv", "evidence/data-platform/coverage-report.md"],
      detail: `streams=${coverage.streamCount} latestValid=${coverage.latestValidStreams} cadenceGaps=${coverage.cadenceGaps}`,
    },
  ];
  const result = { generatedAt: new Date().toISOString(), milestone: "Month 2: Point-in-time data platform", passed: rows.every((row) => row.passed), rows };
  writeFileSync(join(OUT, "month2-exit-audit.json"), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(
    join(OUT, "month2-exit-audit.md"),
    [
      "# Month 2 Exit Audit",
      "",
      `Overall: **${result.passed ? "PASS" : "FAIL"}**`,
      "",
      "| Requirement | Status | Detail | Evidence |",
      "|---|---|---|---|",
      ...rows.map((row) => `| ${row.requirement} | ${row.passed ? "PASS" : "FAIL"} | ${row.detail.replace(/\|/g, "/")} | ${row.evidence.map((file) => `\`${file}\``).join("<br>")} |`),
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK MONTH 2 EXIT AUDIT: ${result.passed ? "PASS" : "FAIL"} (${rows.filter((row) => row.passed).length}/${rows.length})`);
  if (!result.passed) process.exitCode = 1;
  return result;
}

if (process.argv[1]?.endsWith("month2-exit-audit.ts")) runMonth2ExitAudit();
