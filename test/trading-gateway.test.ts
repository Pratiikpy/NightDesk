import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentCredentialStore, GatewayAuthorizationError } from "../src/gateway/auth";
import { NIGHTDESK_PROTOCOL_VERSION } from "../src/gateway/contracts";
import { FileIdempotencyRegistry } from "../src/gateway/idempotency";
import { symbolLaneKey } from "../src/gateway/keyed-execution-queue";
import { GatewayRateLimitError } from "../src/gateway/rate-limit";
import { TradingGateway } from "../src/gateway/trading-gateway";

function setup(limit = 100) {
  const dir = mkdtempSync(join(tmpdir(), "nightdesk-gateway-"));
  const credentials = new AgentCredentialStore();
  credentials.register({
    agentId: "agent-1",
    token: "token-1",
    capabilities: ["health:read", "intent:evaluate", "paper:execute"],
  });
  const gateway = new TradingGateway({
    credentials,
    idempotency: new FileIdempotencyRegistry(join(dir, "idempotency.jsonl")),
    defaultRatePolicy: { limit, windowMs: 60_000 },
  });
  return { gateway, credentials };
}

function request(method: string, params: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
    requestId: `req-${Math.random()}`,
    agentId: "agent-1",
    sessionId: "session-1",
    method,
    params,
    ...extra,
  };
}

test("trading gateway: returns accepted immediately and a final result", async () => {
  const { gateway } = setup();
  gateway.register("intent.evaluate", {
    execute: async ({ request: input }) => ({ verdict: "REJECT", ticker: input.params.ticker }),
  });
  const submission = gateway.submit(request("intent.evaluate", { ticker: "NVDA" }), "token-1");
  assert.equal(submission.accepted.status, "accepted");
  const final = await submission.completion;
  assert.equal(final.status, "ok");
  assert.deepEqual(final.result, { verdict: "REJECT", ticker: "NVDA" });
});

test("trading gateway: concurrent duplicate paper requests execute once", async () => {
  const { gateway } = setup();
  let calls = 0;
  gateway.register("paper.execute", {
    laneKey: (input) => symbolLaneKey(String(input.params.accountId), String(input.params.symbol)),
    execute: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { orderId: "paper-1" };
    },
  });
  const raw = request(
    "paper.execute",
    { accountId: "paper", symbol: "RNVDAUSDT", side: "buy", sizeUsd: 10 },
    { idempotencyKey: "order-1" },
  );
  const one = gateway.submit(raw, "token-1");
  const two = gateway.submit({ ...raw, requestId: "req-two" }, "token-1");
  assert.equal(one.accepted.runId, two.accepted.runId);
  const [first, second] = await Promise.all([one.completion, two.completion]);
  assert.equal(calls, 1);
  assert.equal(first.status, "ok");
  assert.equal(second.status, "ok");
  assert.deepEqual(first.result, { value: { orderId: "paper-1" }, replayed: false });
  assert.deepEqual(second.result, { value: { orderId: "paper-1" }, replayed: true });
});

test("trading gateway: changed request under the same key fails closed", async () => {
  const { gateway } = setup();
  gateway.register("paper.execute", { execute: async () => ({ orderId: "paper-1" }) });
  const base = request("paper.execute", { sizeUsd: 10 }, { idempotencyKey: "same" });
  assert.equal((await gateway.submit(base, "token-1").completion).status, "ok");
  const changed = await gateway.submit(
    { ...base, requestId: "changed", params: { sizeUsd: 20 } },
    "token-1",
  ).completion;
  assert.equal(changed.status, "error");
  assert.equal(changed.error?.code, "IDEMPOTENCY_CONFLICT");
});

test("trading gateway: missing capabilities fail before acceptance", () => {
  const { gateway } = setup();
  assert.throws(
    () => gateway.submit(request("evidence.get", {}), "token-1"),
    GatewayAuthorizationError,
  );
});

test("trading gateway: per-agent method rate limits are enforced", () => {
  const { gateway } = setup(1);
  gateway.submit(request("health.live", {}), "token-1");
  assert.throws(() => gateway.submit(request("health.live", {}), "token-1"), GatewayRateLimitError);
});

test("trading gateway: drain blocks new non-health work and waits for active lanes", async () => {
  const { gateway } = setup();
  gateway.register("paper.execute", {
    laneKey: () => "account:paper",
    execute: async () => new Promise((resolve) => setTimeout(() => resolve("done"), 15)),
  });
  const active = gateway.submit(
    request("paper.execute", {}, { idempotencyKey: "active" }),
    "token-1",
  );
  await gateway.drain();
  assert.equal((await active.completion).status, "ok");
  assert.throws(() => gateway.submit(request("intent.evaluate", {}), "token-1"), /draining/);
  const health = gateway.submit(request("health.live", {}), "token-1");
  assert.equal((await health.completion).status, "ok");
});
