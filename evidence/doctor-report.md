# NightDesk Doctor Report

| Check | Status | Detail |
|---|---|---|
| node_version | pass | 22.17.0 |
| package_scripts | pass | judge:max and judge:max:full expected |
| snapshots | pass | data/snapshots directory |
| bitget_readonly_evidence | pass | live-market-snapshot.json |
| qwen_key | warn | Qwen key optional for deterministic/offline judge path |
| live_trade_default | pass | live trading should be disabled unless explicitly enabled |
| shell_tools_default | pass | shell-capable tools should be opt-in |
| evidence_manifest | pass | max judge manifest |
| ledger_verification | pass | ledger verification evidence |

Secrets are never printed. Environment checks only report presence/absence.
