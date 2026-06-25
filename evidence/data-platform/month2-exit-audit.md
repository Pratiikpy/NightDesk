# Month 2 Exit Audit

Overall: **PASS**

| Requirement | Status | Detail | Evidence |
|---|---|---|---|
| normalized event store and provenance schema | PASS | schema=nightdesk.data.v1 events=192 instruments=19 | `evidence/data-platform/point-in-time-proof.json`<br>`evidence/data-platform/coverage.json` |
| raw and normalized immutable dataset partitions | PASS | raw=true normalized=true duplicate=duplicate | `data/snapshots`<br>`data/normalized`<br>`evidence/data-platform/point-in-time-report.md` |
| generated market calendar and point-in-time corporate actions | PASS | calendar=true futureActionExcluded=true splitAdjustment=true | `evidence/data-platform/point-in-time-proof.json` |
| reliable public stream reconnect, heartbeat, backfill, and gap detection | PASS | deterministic disconnect, gap, recovery, heartbeat, and circuit scenario | `evidence/data-platform/stream-resilience-proof.json`<br>`evidence/data-platform/stream-resilience-report.md` |
| live public ticker and order-book stream receipt | PASS | channels=ticker/books5 | `evidence/data-platform/live-stream-smoke.json`<br>`evidence/data-platform/live-stream-records.jsonl` |
| equity-anchor redundancy and fail-closed contradictions | PASS | two fresh sources required; stale, single-source, and contradictory states block | `evidence/data-platform/anchor-redundancy-proof.json`<br>`evidence/data-platform/live-anchor-comparison.json` |
| full-universe live anchor confirmation | PASS | consensus=19/19 coverage=100% | `evidence/data-platform/live-anchor-universe.json`<br>`evidence/data-platform/live-anchor-universe.csv` |
| data-quality quarantine path | PASS | fixtureExcluded=1 latestQuarantinedStreams=0 | `evidence/data-platform/normalized-events.jsonl`<br>`evidence/data-platform/coverage.json` |
| deterministic historical replay | PASS | replayHash=f487960ba7101c18fdc8c1be2a884466222dd8b00dc1c92e7cdfed0ab97d2848 | `evidence/data-platform/point-in-time-proof.json` |
| point-in-time leakage prevention | PASS | futureEventsExcluded=1 | `evidence/data-platform/point-in-time-proof.json` |
| coverage, latency, quality, and cadence gaps quantified | PASS | streams=64 latestValid=64 cadenceGaps=64 | `evidence/data-platform/coverage.json`<br>`evidence/data-platform/coverage.csv`<br>`evidence/data-platform/coverage-report.md` |
