# NautilusTrader Lessons Applied To NightDesk

NightDesk does not embed NautilusTrader. The useful parts for this hackathon are architectural standards, not a large Rust/Python dependency.

## Lessons Applied

| Nautilus Pattern | NightDesk Translation |
| --- | --- |
| Research/live parity | Same certificate, firewall, order, fill, ledger, and evidence rows are used by paper-session, replay, SDK proof, and Bitget read-only proof |
| Modular adapters | `ExecutionAdapter` and Bitget read-only proof keep paper and live surfaces behind explicit boundaries |
| Event-driven runtime | `run-events.jsonl` records snapshot, certificate, intent, firewall verdict, risk denial, order, fill, account, ledger, and lifecycle events |
| Historical order-book realism | Fill realism rejects empty/crossed/stale/wide books and records partial fills rather than fantasy execution |
| Benchmarking as documentation | PnL casefile and outcome audit document what is being measured, what is not proven, and where the evidence is weak |
| Adapter status discipline | Bitget integration is labeled read-only by default; write/live actions require explicit gating and are not implied by the demo |

## What We Did Not Copy

NightDesk does not copy NautilusTrader's Rust matching engine, Python backtest node, or adapter framework. That would add unnecessary scope and stack risk. The project instead ports the relevant ideas into a small TypeScript evidence layer tailored to Bitget tokenized US stocks.

## Remaining Nautilus-Level Gaps

| Gap | Current NightDesk Status |
| --- | --- |
| Full L2 historical replay for every rToken | Not complete; fill realism cases exist, but long L2 history is still needed |
| Research-to-live identical execution over write-capable Bitget orders | Not claimed; current proof is read-only live plus paper execution |
| Performance benchmark suite | Not needed for hackathon scale; evidence commands are reproducible, but not benchmarked like an engine |
| Full false-block PnL attribution | Not complete; PnL casefile labels false-block cost as not measured |

The result is a pragmatic subset: enough rigor to make the Bitget hackathon evidence credible without turning NightDesk into a generic trading engine.
