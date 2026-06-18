# Agent Hub Skill Hub — real integration proof

The official Bitget Agent Hub **macro-analyst** Skill Hub skill drives NightDesk's macro
event-aware abstention through the `MacroWindow` provider interface.

- Skill: macro-analyst (Bitget Agent Hub Skill Hub)
- As of: 2026-06-18 | regime: RISK_ON | verdict: MIXED-leaning-RISK_ON
- Indicators: VIX 16.38, DXY 99.54, 10Y 4.428%
- Mapped MacroWindow: active=false, severity=medium
- **NightDesk desk decision: TRADE-ELIGIBLE (low-information macro window — macro gate does not force abstention)**

Rationale: VIX 16.38 (low/calm); FOMC concluded Jun 17; no high-severity scheduled US macro event in the next 24-48h (next is CPI on Jul 14). Low-information macro window -> the macro risk-off gate does NOT force abstention today.

This converts "Agent Hub compatible" into "Agent Hub used": the Skill Hub skill's output
flows directly into NightDesk's loop via a drop-in `MacroWindow`.
