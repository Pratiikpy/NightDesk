import { test } from "node:test";
import assert from "node:assert/strict";
import {
  METHOD_CAPABILITY,
  NIGHTDESK_PROTOCOL_VERSION,
  GatewayRequestValidationError,
  parseGatewayRequest,
} from "../src/gateway/contracts";
import {
  AgentCredentialStore,
  GatewayAuthenticationError,
  GatewayAuthorizationError,
} from "../src/gateway/auth";
import { GatewayRateLimitError, SlidingWindowRateLimiter } from "../src/gateway/rate-limit";
import { GatewayRuntimeStatus } from "../src/gateway/runtime-status";

const T0 = Date.parse("2026-06-24T12:00:00.000Z");
const valid = (over: Record<string, unknown> = {}) => ({
  protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
  requestId: "request-1",
  agentId: "agent-1",
  sessionId: "session-1",
  method: "intent.evaluate",
  params: { ticker: "NVDA", side: "buy", sizeUsd: 10 },
  deadlineAt: new Date(T0 + 60_000).toISOString(),
  ...over,
});

test("gateway contract: validates a supported request", () => {
  assert.deepEqual(parseGatewayRequest(valid(), T0), valid());
});

test("gateway contract: rejects unsupported versions and methods", () => {
  assert.throws(
    () => parseGatewayRequest(valid({ protocolVersion: "nightdesk.v0", method: "order.place" }), T0),
    GatewayRequestValidationError,
  );
});

test("gateway contract: side-effecting methods require idempotency keys", () => {
  assert.throws(
    () => parseGatewayRequest(valid({ method: "paper.execute" }), T0),
    /idempotencyKey is required/,
  );
  assert.equal(
    parseGatewayRequest(valid({ method: "paper.execute", idempotencyKey: "order-1" }), T0).idempotencyKey,
    "order-1",
  );
});

test("gateway contract: expired deadlines fail before work enters a queue", () => {
  assert.throws(
    () => parseGatewayRequest(valid({ deadlineAt: new Date(T0 - 1).toISOString() }), T0),
    /deadlineAt has expired/,
  );
});

test("gateway auth: token verification, capability enforcement, and revocation", () => {
  const store = new AgentCredentialStore();
  store.register({ agentId: "agent-1", token: "secret-token", capabilities: ["intent:evaluate"] });
  assert.throws(() => store.authenticate("agent-1", "wrong"), GatewayAuthenticationError);
  const principal = store.authenticate("agent-1", "secret-token");
  store.authorize(principal, METHOD_CAPABILITY["intent.evaluate"]);
  assert.throws(() => store.authorize(principal, "paper:execute"), GatewayAuthorizationError);
  store.revoke("agent-1");
  assert.throws(() => store.authenticate("agent-1", "secret-token"), GatewayAuthenticationError);
});

test("gateway rate limit: isolates scopes and returns deterministic retry timing", () => {
  const limiter = new SlidingWindowRateLimiter();
  const policy = { limit: 2, windowMs: 1000 };
  assert.equal(limiter.consume("intent", "agent-1", policy, T0).allowed, true);
  assert.equal(limiter.consume("intent", "agent-1", policy, T0 + 1).allowed, true);
  const denied = limiter.consume("intent", "agent-1", policy, T0 + 2);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 998);
  assert.equal(limiter.consume("market", "agent-1", policy, T0 + 2).allowed, true);
  assert.throws(() => limiter.enforce("intent", "agent-1", policy, T0 + 3), GatewayRateLimitError);
});

test("gateway runtime status: readiness fails closed on required degradation and drain", () => {
  const status = new GatewayRuntimeStatus(() => [{ key: "account:a", active: true, queued: 2 }], T0);
  status.setComponent("ledger", "ready");
  status.setComponent("anchor", "degraded", { detail: "stale", required: true });
  let snapshot = status.snapshot(T0 + 100);
  assert.equal(snapshot.live, true);
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.lanes[0]?.queued, 2);
  status.setComponent("anchor", "ready");
  status.markSuccess(new Date(T0 + 200));
  snapshot = status.snapshot(T0 + 300);
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.lastSuccessAt, new Date(T0 + 200).toISOString());
  status.setAccepting(false);
  assert.equal(status.snapshot(T0 + 400).ready, false);
});
