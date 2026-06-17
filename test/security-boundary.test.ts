import test from "node:test";
import assert from "node:assert/strict";
import { envSecurityConfig, evaluateLiveTradeBoundary, evaluateShellToolBoundary, isTrustedLocalHost } from "../src/security/boundaries";

test("security boundary: live trading is disabled by default", () => {
  const decision = evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: false, notionalUsd: 1 }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "LIVE_TRADE_DISABLED");
});

test("security boundary: live path only allows dust-sized limit orders without leverage", () => {
  assert.equal(evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, notionalUsd: 9, orderType: "limit", leverage: 1 })).allowed, true);
  assert.equal(evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, notionalUsd: 11, orderType: "limit", leverage: 1 })).reason, "DUST_NOTIONAL_CAP_10_USDT");
  assert.equal(evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, notionalUsd: 9, orderType: "market", leverage: 1 })).reason, "LIVE_REQUIRES_LIMIT_ORDER");
  assert.equal(evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, notionalUsd: 9, orderType: "limit", leverage: 2 })).reason, "LEVERAGE_DISABLED_BY_DEFAULT");
});

test("security boundary: remote clients need auth for live/shell capability", () => {
  assert.equal(isTrustedLocalHost("localhost:8787"), true);
  assert.equal(isTrustedLocalHost("evil.localhost.attacker"), false);
  assert.equal(evaluateLiveTradeBoundary(envSecurityConfig({ enableLiveTrade: true, clientHost: "10.0.0.7", apiAuthKeyPresent: false, notionalUsd: 1 })).reason, "REMOTE_API_REQUIRES_AUTH");
  assert.equal(evaluateShellToolBoundary(envSecurityConfig({ enableShellTools: false })).reason, "SHELL_TOOLS_DISABLED");
  assert.equal(evaluateShellToolBoundary(envSecurityConfig({ enableShellTools: true, clientHost: "10.0.0.7", apiAuthKeyPresent: false })).reason, "REMOTE_API_REQUIRES_AUTH");
});
