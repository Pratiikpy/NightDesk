# Safety Alpha Report

Safety alpha is economic value from preventing bad actions, not simply producing a green PnL number.

The blocked-loss figure below is a raw repeated-intent diagnostic from replay, not a realized cash saving. It is useful for comparing filter pressure and unsafe exposure, but it should not be pitched as literal USDT profit.

| Metric |Value |Interpretation |
| --- |--- |--- |
| Raw blocked-loss diagnostic |15167.8809 USDT |sum of repeated counterfactual losing intents in OOS/session study |
| Mean blocked-loss diagnostic per block |0.863037 USDT |normalizes the repeated-intent exposure |
| False block cost |not measured |needs per-block counterfactual winner/loss attribution |
| Guarded replay PnL |4.3440 USDT |positive same-sample execution evidence |
| Paper session PnL |-0.3345 USDT |valid compliance record, not tuned for profit |
