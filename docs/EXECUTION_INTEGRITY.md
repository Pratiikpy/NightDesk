# Execution Integrity Standards

NightDesk holds its execution and evidence layer to production-grade standards, implemented as a small,
reproducible TypeScript layer tailored to Bitget tokenized US stocks — no heavyweight engine dependency.

## Standards Applied

| Standard | NightDesk Implementation |
| --- | --- |
| Research/live parity | The same certificate, firewall, order, fill, ledger, and evidence rows are used by paper-session, replay, SDK proof, and Bitget read-only proof |
| Modular adapters | `ExecutionAdapter` and the Bitget read-only proof keep paper and live surfaces behind explicit boundaries |
| Event-driven runtime | `run-events.jsonl` records snapshot, certificate, intent, firewall verdict, risk denial, order, fill, account, ledger, and lifecycle events |
| Enforced order lifecycle | An order's status is the fold of its event log against a literal transition table; illegal transitions (fill a canceled order, double-fill past quantity, deny after submit) are impossible |
| Order-book realism | Fill realism rejects empty/crossed/stale/wide books and records partial fills rather than fantasy execution; latency + tick-quantized slippage are modeled, not assumed |
| Benchmarking as documentation | The PnL casefile and outcome audit document what is being measured, what is not proven, and where the evidence is weak |
| Adapter status discipline | Bitget integration is labeled read-only by default; write/live actions require explicit gating and are not implied by the demo |

## Scope Discipline

NightDesk implements only the subset needed to make the evidence credible — an enforced order state
machine, realistic fills with modeled latency/slippage, and signed, reproducible records — without
turning into a generic trading engine.

## Known Gaps (stated honestly)

| Gap | Current NightDesk Status |
| --- | --- |
| Full L2 historical replay for every rToken | Not complete; fill realism cases exist, but long L2 history is still needed |
| Research-to-live identical execution over write-capable Bitget orders | Not claimed; current proof is read-only live plus paper execution |
| Performance benchmark suite | Not needed at hackathon scale; evidence commands are reproducible, but not benchmarked like an engine |
| Full false-block PnL attribution | Not complete; the PnL casefile labels false-block cost as not measured |

The result is a pragmatic subset: enough rigor to make the Bitget hackathon evidence credible without
overbuilding.
