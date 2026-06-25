# Point-in-Time Data Platform Proof

- Schema: `nightdesk.data.v1`
- Immutable events written: 4
- Events visible at cutoff: 2
- Future-arriving events excluded: 1
- Quarantined events excluded: 1
- Sequence gaps detected: 1
- Deterministic replay: PASS
- Contradictory anchors fail closed: PASS
- Generated exchange calendar covers 2027: PASS
- Future-known corporate action excluded: PASS
- Split adjustment is point-in-time correct: PASS
- Duplicate append: duplicate
- Replay hash: `f487960ba7101c18fdc8c1be2a884466222dd8b00dc1c92e7cdfed0ab97d2848`

The replay uses `receivedAt` as its knowledge cutoff. Revisions received after that cutoff are
excluded even when their market-effective timestamp is earlier. Quarantined observations remain
in immutable storage for audit but are excluded from trading/research replay by default.
