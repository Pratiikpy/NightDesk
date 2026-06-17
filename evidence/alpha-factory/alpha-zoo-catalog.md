# NightDesk Alpha Zoo

Domain-specific alpha catalogue inspired by Vibe-Trading's Alpha Zoo, but scoped to Bitget tokenized US stocks.

| Alpha | Family | Thesis | Safety Filter |
|---|---|---|---|
| true_gap_fade | fair_value | Buy cheap rTokens only when the token trades below the official equity anchor after fees. | certificate must be MISPRICED/LONG_ONLY_FADE and all hard gates must pass |
| perp_illusion_fade | basis_diagnostic | Fade cases where the perp/rToken relationship reveals an off-hours dislocation hidden from naive equity anchoring. | reject stale anchors, thin books, and sub-fee-floor edge |
| liquidity_clean_gap | execution_quality | Only trade gaps when the quote/book state can survive fees, spread, and depth checks. | liquidity_score high; slippage_bps less than modeled edge |
| session_phase_gap | session_microstructure | Separate off-hours, pre-open, post-close, weekend, holiday, and RTH stand-down regimes. | NYSE calendar state must permit the claim being tested |
| news_aware_abstain | event_risk | Do not fade fresh company news even if the gap looks statistically attractive. | fresh catalyst forces ABSTAIN |
| macro_aware_block | event_risk | High-severity macro windows can make cross-asset gaps non-stationary; block instead of forcing a trade. | macro severity high => no tradeable certificate |
| tracking_error_filter | token_quality | Only allow size on tokens whose rToken tracking behavior is reliable enough to support fair-value claims. | A/B grades preferred; C/D capped or blocked |
| tight_book_only | execution_quality | A signal is not tradeable unless spread and available depth leave positive net edge. | empty/one-sided/crossed/stale/wide books rejected |
| high_threshold_only | overfit_control | Require larger gaps to reduce churn and avoid sub-fee noise. | Overfit Court rejects fragile thresholds |
| weekend_to_monday_gap | calendar_regime | Weekend gaps are measured separately because equity anchor is stale for longer and Monday open resolves the claim. | stale anchor cannot be tradeable unless the run is explicitly research-only |
