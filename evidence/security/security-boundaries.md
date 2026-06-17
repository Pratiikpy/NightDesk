# Security Boundaries

| Boundary | Allowed | Reason |
|---|---:|---|
| live_default | false | LIVE_TRADE_DISABLED |
| live_dust_limit | true | LIVE_DUST_LIMIT_ORDER_ALLOWED |
| live_market_order | false | LIVE_REQUIRES_LIMIT_ORDER |
| shell_default | false | SHELL_TOOLS_DISABLED |

Rules: read-only by default, live trading disabled by default, live requires explicit opt-in, limit order, no leverage, and dust notional cap of 10 USDT.
Secrets are never printed by this report.
