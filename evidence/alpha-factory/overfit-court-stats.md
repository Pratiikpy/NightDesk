# Overfit Court — Selection-Bias Controls

The Alpha Factory searches many strategies, so the single best in-sample result is partly luck.
These are the canonical corrections for that (Bailey & Lopez de Prado), computed from the frozen
trial registry. By design they are conservative — we would rather understate the edge than oversell it.

| Control | Value | Reading |
| --- | --- | --- |
| Trials searched (N) | 9,720 | the multiple-testing budget we deflate for |
| Champion sessions (T) | 5 | length of the out-of-sample-style record so far |
| Raw per-session Sharpe | 0.6718 | before any correction |
| Expected max Sharpe from N trials | 1.6635 | the bar luck alone would clear |
| Probabilistic Sharpe vs 0 | 95.2% | P(true Sharpe > 0) |
| **Deflated Sharpe** | **0.7%** | P(edge survives the N-trial correction); significant at ≥95.0%: **NO** |
| Min track record length | 5 sessions | sessions needed for significance vs 0; have 5 |
| Probability of backtest overfitting | not yet computable — needs ≥8 session slices, have 5 (accumulating) | lower is better; ~50% = no better than chance |

**Verdict.** Probabilistic Sharpe vs 0 is 95.2%, but the champion's raw Sharpe (0.67) sits below the expected best-of-9,720 luck bar (1.66), so the Deflated Sharpe is 0.7%. We tested the raw convergence edge honestly: on 5 sessions it is not yet statistically significant. The raw edge alone is not the product — NightDesk's value is turning these noisy gaps into certified, gated, executable decisions.

_Method: Deflated/Probabilistic Sharpe & MinTRL (Bailey & Lopez de Prado, 2012/2014); PBO via CSCV (Bailey, Borwein, Lopez de Prado & Zhu, 2017). Original implementation._
