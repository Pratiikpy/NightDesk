# Gate Coverage

Status: PASS

| Gate | Pass Case | Fail Case | Fail Reason |
| --- | --- | --- | --- |
| 12_kill_switch | true | true | kill switch engaged |
| 11_stale_data | true | true | dataAge=120s (max 60) |
| 1_max_position | true | true | 13.0% (max 10) |
| 2_max_gross | true | true | 55.0% (max 50) |
| 3_depeg | true | true | state=DISLOCATED basisArb=false |
| 4_liquidity | true | true | slip=0.9% (max 0.3) |
| 5_event_confidence | true | true | conf=0.2 grounded=true |
| 6_leverage | true | true | lev=5 (max 3) |
| 7_correlation | true | true | correlated=3 (max 2) |
| 13_net_edge | true | true | netEdge=-0.320% (edge 0.1 − fee 0.32 − slip 0.1; margin 0%) |
| 14_var | true | true | VaR95=1.645% (max 1.5%) |
| 15_oracle_deviation | true | true | anchorDev=40.00% (max 25%) |
| 8_stop_loss | true | true | live action emitted |
| 9_daily_drawdown | true | true | live action emitted |
| 10_flat_by_open | true | true | live action emitted |
