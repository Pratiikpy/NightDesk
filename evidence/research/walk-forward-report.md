# NightDesk Research Node

Recording: data/snapshots/2026-06-15.jsonl
Total snapshots with equity anchors: 1452
Train snapshots: 871
Test snapshots: 581
Selected threshold: 0.05%

This report is intentionally conservative: it selects a threshold by signal stability, not same-sample PnL. The profitable guarded replay remains execution evidence unless an out-of-sample recording is provided.

To regenerate execution evidence:

```bash
npm run paper-replay
```
