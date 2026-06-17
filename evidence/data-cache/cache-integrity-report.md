# Cache Integrity Report

Rule: settled historical snapshot files can be reused for deterministic replay; today's or future-dated files must not be treated as settled OOS proof.

| File | Bytes | Status |
|---|---:|---|
| data/snapshots/2026-06-14.jsonl | 8571528 | settled_replay_fixture |
| data/snapshots/2026-06-15.jsonl | 25764641 | settled_replay_fixture |
| data/snapshots/2026-06-16.jsonl | 161924 | settled_replay_fixture |
| data/snapshots/2026-06-17.jsonl | 1187086 | forming_or_recent_do_not_treat_as_settled |
