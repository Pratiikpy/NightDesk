import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileIdempotencyRegistry,
  IdempotencyConflictError,
  IdempotencyRecoveryRequiredError,
} from "../src/gateway/idempotency";
import {
  KeyedExecutionQueue,
  QueueDrainingError,
  QueueTaskTimeoutError,
  symbolLaneKey,
} from "../src/gateway/keyed-execution-queue";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("idempotency: concurrent duplicate requests execute once and share one run", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nightdesk-idem-"));
  const registry = new FileIdempotencyRegistry(join(dir, "journal.jsonl"));
  let calls = 0;
  const operation = async () => {
    calls += 1;
    await delay(20);
    return { orderId: "order-1" };
  };
  const request = { accountId: "paper", symbol: "RNVDAUSDT", side: "buy", sizeUsd: 10 };
  const [first, second] = await Promise.all([
    registry.execute({ scope: "paper.execute", key: "same", request, operation }),
    registry.execute({ scope: "paper.execute", key: "same", request, operation }),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.runId, second.runId);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(first.value, second.value);
});

test("idempotency: completed result replays after process-style registry restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nightdesk-idem-"));
  const file = join(dir, "journal.jsonl");
  const request = { symbol: "RNVDAUSDT", quantity: 1 };
  await new FileIdempotencyRegistry(file).execute({
    scope: "paper.execute",
    key: "restart",
    request,
    operation: async () => ({ fillId: "fill-1" }),
    runId: "run-fixed",
  });
  let called = false;
  const replay = await new FileIdempotencyRegistry(file).execute({
    scope: "paper.execute",
    key: "restart",
    request,
    operation: async () => {
      called = true;
      return { fillId: "bad" };
    },
  });
  assert.equal(called, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.runId, "run-fixed");
  assert.deepEqual(replay.value, { fillId: "fill-1" });
  assert.equal(readFileSync(file, "utf8").trim().split("\n").length, 2);
});

test("idempotency: key reuse with a changed request is rejected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nightdesk-idem-"));
  const registry = new FileIdempotencyRegistry(join(dir, "journal.jsonl"));
  await registry.execute({ scope: "paper.execute", key: "key", request: { size: 1 }, operation: async () => "ok" });
  await assert.rejects(
    registry.execute({ scope: "paper.execute", key: "key", request: { size: 2 }, operation: async () => "bad" }),
    IdempotencyConflictError,
  );
});

test("idempotency: an interrupted running record fails closed after restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nightdesk-idem-"));
  const file = join(dir, "journal.jsonl");
  const registry = new FileIdempotencyRegistry(file);
  const pending = registry.execute({
    scope: "live.execute",
    key: "uncertain",
    request: { order: 1 },
    operation: async () => new Promise<never>(() => {}),
    runId: "run-uncertain",
  });
  await delay(5);
  void pending;
  const restarted = new FileIdempotencyRegistry(file);
  await assert.rejects(
    restarted.execute({ scope: "live.execute", key: "uncertain", request: { order: 1 }, operation: async () => "unsafe retry" }),
    IdempotencyRecoveryRequiredError,
  );
});

test("execution queue: same lane is serial and different lanes can overlap", async () => {
  const queue = new KeyedExecutionQueue();
  let activeSame = 0;
  let maxSame = 0;
  let activeGlobal = 0;
  let maxGlobal = 0;
  const task = async () => {
    activeSame += 1;
    activeGlobal += 1;
    maxSame = Math.max(maxSame, activeSame);
    maxGlobal = Math.max(maxGlobal, activeGlobal);
    await delay(15);
    activeSame -= 1;
    activeGlobal -= 1;
  };
  const laneA = symbolLaneKey("acct", "rnvdausdt");
  const laneB = symbolLaneKey("acct", "rtslausdt");
  await Promise.all([
    queue.enqueue(laneA, task),
    queue.enqueue(laneA, task),
    queue.enqueue(laneB, async () => {
      activeGlobal += 1;
      maxGlobal = Math.max(maxGlobal, activeGlobal);
      await delay(15);
      activeGlobal -= 1;
    }),
  ]);
  assert.equal(maxSame, 1);
  assert.ok(maxGlobal >= 2);
});

test("execution queue: priority applies to queued work while preserving active work", async () => {
  const queue = new KeyedExecutionQueue();
  const order: string[] = [];
  const first = queue.enqueue("account:a", async () => {
    order.push("active");
    await delay(15);
  });
  const low = queue.enqueue("account:a", async () => void order.push("low"), { priority: 0 });
  const high = queue.enqueue("account:a", async () => void order.push("high"), { priority: 10 });
  await Promise.all([first, low, high]);
  assert.deepEqual(order, ["active", "high", "low"]);
});

test("execution queue: timeout aborts an aware task and the lane continues safely", async () => {
  const queue = new KeyedExecutionQueue();
  const timed = queue.enqueue(
    "account:a",
    async (signal) =>
      new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
    { timeoutMs: 10 },
  );
  await assert.rejects(timed, QueueTaskTimeoutError);
  assert.equal(await queue.enqueue("account:a", async () => "next"), "next");
});

test("execution queue: drain rejects new work and waits for active work", async () => {
  const queue = new KeyedExecutionQueue();
  let finished = false;
  const active = queue.enqueue("account:a", async () => {
    await delay(15);
    finished = true;
  });
  const drained = queue.drain();
  await assert.rejects(queue.enqueue("account:a", async () => undefined), QueueDrainingError);
  await drained;
  await active;
  assert.equal(finished, true);
  assert.deepEqual(queue.snapshot(), []);
});
