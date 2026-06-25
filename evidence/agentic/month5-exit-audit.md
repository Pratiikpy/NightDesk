# Month 5 Exit Audit — Agentic Research Loop

Result: PASS (5/5)

| Exit-gate requirement | Status | Detail |
| --- | --- | --- |
| agent generates valid, grounded DSL experiments without held-out access | PASS | 3 experiments; dsl-valid=true; grounded=true; point-in-time-isolated=true |
| ungrounded request yields no experiment | PASS | empty evidence → 0 experiments |
| validator rejects unsafe DSL experiments (oversize, disabled risk controls) | PASS | oversize→[notionalPct must be in (0,1]] disabled-controls→[hard risk controls cannot be disabled] |
| ablation: the agentic layer stands down on a catalyst the fixed policy trades | PASS | fixed trades=1; agentic trades=0/abstained=1 |
| memory retrieval is temporally valid (no future leakage) and source-linked | PASS | recall@t0 before-future n=0; after-add-t0 n=1; source-linked=true |

The agent proposes experiments from point-in-time evidence only; deterministic code validates, gates,
and grades. No held-out outcome is visible to generation, and memory recall cannot leak the future.
