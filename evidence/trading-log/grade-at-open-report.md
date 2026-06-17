# Grade At Open Report

This paper session is an execution-path evidence run: it proves that agent intents pass through certificates, firewall decisions, PaperPit/BitSim fills, balance changes, event logs, and a signed ledger hash.

For open-resolution convergence grading, run an off-hours to NYSE-open recording through:

```bash
npm run simulate data/snapshots/<open-spanning-recording>.jsonl -- --grade-at-open
```

NightDesk treats TRADE, ABSTAIN, and BLOCK as first-class agent actions; blocked rows are not hidden from the record.
