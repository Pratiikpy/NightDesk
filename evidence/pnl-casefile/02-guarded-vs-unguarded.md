# Guarded vs Unguarded Same-Agent Delta

Each row compares the same intent policy before and after routing through NightDesk. The point is not raw turnover; the point is whether the safety gateway improves PnL, drawdown, or unsafe-action behavior under the same market path.

| Agent |Unguarded PnL |Guarded PnL |Delta |Unguarded DD |Guarded DD |Interpretation |
| --- |--- |--- |--- |--- |--- |--- |
| naive_gap |3.504882 |2.860297 |-0.644585 |3.281314 |2.3645 |guarded_reduced_drawdown |
| perp_trust |7.791439 |2.231036 |-5.560403 |1.105905 |3.390378 |guarded_cost_more_in_this_sample |
| momentum |9.974693 |2.353547 |-7.621146 |0.911086 |1.659257 |guarded_cost_more_in_this_sample |
| news_blind |3.504882 |2.860297 |-0.644585 |3.281314 |2.3645 |guarded_reduced_drawdown |
| random |9.768537 |2.697026 |-7.071511 |0.95 |1.171664 |guarded_cost_more_in_this_sample |
