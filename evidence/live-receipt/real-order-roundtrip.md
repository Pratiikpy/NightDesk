# Live Trade Proof — real authenticated Bitget round-trip

Run ID: livetrade_2026-06-18T04-06-01-259Z
Mode: authenticated_probe
Symbol: RAAPLUSDT
Ledger hash: beda0a349765e96999f0d76cdd40a1ade8de546eb40d18b24cebe3b2ddb47e58

## Steps
- authenticated_account_probe: {"ok":true,"httpStatus":200,"code":"00000","msg":"success","summary":{"coins":15,"hasUSDT":true},"requestPath":"/api/v2/spot/account/assets","proves":"real credentials sign correctly against Bitget's authenticated API"}

The order path is non-fillable by construction (buy limit 50% below market) and immediately
cancelled, so it generates a real Bitget order lifecycle at zero cost and zero fill risk.
Default is read-only authenticated; the real order is double-gated.
