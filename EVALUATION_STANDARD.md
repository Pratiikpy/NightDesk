# NightDesk Evaluation Standard

NightDesk is evaluated as an agent safety gateway, not as a pure profit-maximizing bot.

The core question is:

```txt
Does certificate-gated execution make external agents safer and more reproducible when trading Bitget tokenized US stocks?
```

## Required Evidence

- Paper trading record: `evidence/trading-log/nightdesk-paper-trading-log.csv`
- Guarded replay: `evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv`
- Multi-session OOS study: `evidence/oos/oos-report.md`
- Walk-forward PnL report: `evidence/walkforward/pnl-report.md`
- Fill realism report: `evidence/fill-model/fill-model-report.md`
- External integration proof: `evidence/integration/external-agent-run.jsonl`
- Bitget public read-only proof: `evidence/bitget-live/read-only-proof.md`
- Max judge manifest: `evidence/max-judge-manifest.json`

## Metrics

- PnL and balance change
- Max drawdown
- Number of trades, blocks, and abstentions
- Guarded versus unguarded delta
- Blocked unsafe-intent count
- Estimated blocked loss
- Fill model and slippage
- Ledger hash and signature verification

## Claims We Do Not Make

- NightDesk does not claim universal alpha.
- One replay is not presented as permanent profitability.
- Same-sample threshold search is labeled as execution evidence, not out-of-sample alpha.
- Live trading is disabled by default; public Bitget proof is read-only.

## Reproduce

```bash
npm run judge:max
```
