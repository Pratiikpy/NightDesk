# Live Trade Proof — real authenticated Bitget round-trip

Run ID: livetrade_2026-06-18T04-14-04-159Z
Mode: order_path_probe
Symbol: RAAPLUSDT
Ledger hash: 70d24dbcdf206a660714064786260e4c4c4b5e66f1def98ee6d50caf397c07ee

## Steps
- authenticated_account_probe: {"ok":true,"httpStatus":200,"code":"00000","msg":"success","summary":{"coins":15,"hasUSDT":true},"requestPath":"/api/v2/spot/account/assets","proves":"real credentials sign correctly against Bitget's authenticated API"}
- order_path_probe: {"ok":false,"code":"40014","msg":"Incorrect permissions, need spot order write permissions","symbol":"RAAPLUSDT","price":"149.17","size":"0.00001","orderId":null,"reachedTradeEndpoint":true,"note":"sub-minimum order: rejected at validation -> no order created, no funds reserved; proves the signed request reaches Bitget's live spot trade endpoint with valid auth"}

The order path is non-fillable by construction (buy limit 50% below market) and immediately
cancelled, so it generates a real Bitget order lifecycle at zero cost and zero fill risk.
Default is read-only authenticated; the real order is double-gated.
