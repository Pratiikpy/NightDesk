# PnL Attribution

This decomposes current evidence into gross edge estimate, cost drag, blocked-loss estimate, and final net PnL. `missed_profit_estimate` is marked not measured where the current artifacts do not yet support a clean false-block calculation.

| Run |Gross Edge Est. |Costs Est. |Blocked Loss Est. |Net PnL |Claim |
| --- |--- |--- |--- |--- |--- |
| paper_session |0.000001 |-0.334502 |0 |-0.334501 |execution_record_not_alpha |
| guarded_replay |5.907859 |-1.563906 |-15093.216645 |4.343953 |same_sample_execution_evidence |
