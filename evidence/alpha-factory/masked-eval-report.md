# Masked Evaluation Report

The frozen champion is selected from numeric features only: source, direction, thresholds, sizing, holding, fees, PnL, drawdown, and trade counts.

Masked fields: ticker names, company names, narrative labels, and calendar dates are not inputs to the strategy config search.

Frozen champion: perp_gap_fade_e0p35_x0_tp2_sl0p75_h9999_n0p5_m2
Signal source: perp_gap
Decision type: fade

Result: the alpha factory is not asking an LLM to remember named historical events. It is ranking deterministic numeric strategies on recorded market paths.
