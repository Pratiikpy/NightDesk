import test from "node:test";
import assert from "node:assert/strict";
import { reconnectDelay, SequenceContinuity, StreamCircuitBreaker } from "../src/data/stream-runtime";
import {
  BitgetPublicStream,
  BITGET_PUBLIC_WS,
  parseBitgetPublicMessage,
  type BitgetStreamRecord,
  type SocketLike,
  type TimerScheduler,
} from "../src/bitget/public-stream";

class ManualScheduler implements TimerScheduler {
  private time = 1_000;
  private nextId = 1;
  private tasks = new Map<number, { at: number; callback: () => void }>();

  now(): number { return this.time; }
  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.time + delayMs, callback });
    return id;
  }
  clearTimeout(handle: unknown): void { this.tasks.delete(Number(handle)); }
  advance(ms: number): void {
    const target = this.time + ms;
    while (true) {
      const next = [...this.tasks.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next || next[1].at > target) break;
      this.time = next[1].at;
      this.tasks.delete(next[0]);
      next[1].callback();
    }
    this.time = target;
  }
}

class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closes: { code?: number; reason?: string }[] = [];

  send(data: string): void { this.sent.push(data); }
  close(code?: number, reason?: string): void {
    this.closes.push({ code, reason });
    this.onclose?.({ code, reason });
  }
  open(): void { this.onopen?.(); }
  message(data: unknown): void { this.onmessage?.({ data }); }
  disconnect(): void { this.onclose?.({ code: 1006, reason: "network" }); }
}

const flush = async (turns = 8): Promise<void> => {
  for (let index = 0; index < turns; index++) await Promise.resolve();
};

test("reconnect policy is bounded and deterministic with injected randomness", () => {
  const options = { baseDelayMs: 100, maxDelayMs: 800, jitterRatio: 0.2 };
  assert.equal(reconnectDelay(0, options, () => 0.5), 100);
  assert.equal(reconnectDelay(3, options, () => 0.5), 800);
  assert.equal(reconnectDelay(10, options, () => 0), 640);
});

test("stream circuit opens, blocks, then permits one half-open probe", () => {
  const circuit = new StreamCircuitBreaker(2, 1_000);
  circuit.failure(100);
  circuit.failure(200);
  assert.equal(circuit.snapshot(500).state, "open");
  assert.equal(circuit.allow(500), false);
  assert.equal(circuit.snapshot(1_200).state, "half_open");
  assert.equal(circuit.allow(1_200), true);
  assert.equal(circuit.allow(1_200), false);
  circuit.success();
  assert.equal(circuit.snapshot(1_200).state, "closed");
});

test("sequence continuity distinguishes gaps from replay/regression", () => {
  const continuity = new SequenceContinuity();
  assert.equal(continuity.observe("s", 10).status, "first");
  assert.equal(continuity.observe("s", 11).status, "contiguous");
  assert.deepEqual(continuity.observe("s", 13), { status: "gap", expected: 12, actual: 13 });
  assert.deepEqual(continuity.observe("s", 12), { status: "regression", expected: 14, actual: 12 });
});

test("Bitget public parser accepts known channels and ignores control frames", () => {
  const rows = parseBitgetPublicMessage({
    action: "update",
    arg: { instType: "SPOT", channel: "books5", instId: "RNVDAUSDT" },
    data: [{ seq: "42", ts: "900", bids: [["99", "1"]], asks: [["100", "1"]] }],
  }, 1_000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.stream, "SPOT|books5|RNVDAUSDT");
  assert.equal(rows[0]?.sequence, 42);
  assert.equal(rows[0]?.sourceTs, 900);
  assert.deepEqual(parseBitgetPublicMessage({ event: "subscribe" }, 1_000), []);
});

test("public stream detects gaps, backfills, reconnects, resubscribes, and restores live state", async () => {
  const scheduler = new ManualScheduler();
  const sockets: FakeSocket[] = [];
  const records: BitgetStreamRecord[] = [];
  const gaps: string[] = [];
  let backfills = 0;
  const topic = { instType: "SPOT" as const, channel: "books5" as const, instId: "RNVDAUSDT" };
  const stream = new BitgetPublicStream({
    topics: [topic],
    scheduler,
    socketFactory: (url) => {
      assert.equal(url, BITGET_PUBLIC_WS);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    reconnect: { baseDelayMs: 100, maxDelayMs: 1_000, jitterRatio: 0 },
    heartbeatIntervalMs: 1_000,
    pongTimeoutMs: 100,
    random: () => 0.5,
    backfill: async (requested) => {
      backfills++;
      return [{ stream: "SPOT|books5|RNVDAUSDT", topic: requested, action: "backfill", sequence: null, sourceTs: 995, receivedAt: scheduler.now(), payload: { bids: [], asks: [] } }];
    },
    handlers: {
      onRecord: (record) => { records.push(record); },
      onGap: (gap) => { gaps.push(gap.reason); },
    },
  });

  stream.start();
  assert.equal(stream.status().state, "connecting");
  sockets[0]!.open();
  await flush();
  assert.equal(stream.status().state, "live");
  assert.match(sockets[0]!.sent[0]!, /"op":"subscribe"/);

  sockets[0]!.message(JSON.stringify({ action: "snapshot", arg: { ...topic }, data: [{ seq: 1, ts: 990, bids: [], asks: [] }] }));
  sockets[0]!.message(JSON.stringify({ action: "update", arg: { ...topic }, data: [{ seq: 3, ts: 999, bids: [], asks: [] }] }));
  await flush(20);
  assert.deepEqual(gaps, ["sequence_gap"]);
  assert.equal(backfills, 1);
  assert.deepEqual(records.map((record) => record.action), ["snapshot", "backfill", "update"]);
  assert.equal(stream.status().state, "live");

  sockets[0]!.disconnect();
  assert.equal(stream.status().state, "degraded");
  assert.equal(stream.status().nextReconnectAt, scheduler.now() + 100);
  scheduler.advance(100);
  assert.equal(sockets.length, 2);
  sockets[1]!.open();
  await flush(20);
  assert.equal(backfills, 2, "reconnect performs a snapshot backfill before live processing");
  assert.equal(gaps.at(-1), "reconnect_backfill");
  assert.equal(stream.status().state, "live");
  assert.match(sockets[1]!.sent[0]!, /"op":"subscribe"/);
  stream.stop();
  assert.equal(stream.status().state, "stopped");
});

test("heartbeat timeout closes a silent socket and schedules recovery", async () => {
  const scheduler = new ManualScheduler();
  const socket = new FakeSocket();
  const stream = new BitgetPublicStream({
    topics: [{ instType: "SPOT", channel: "ticker", instId: "RNVDAUSDT" }],
    scheduler,
    socketFactory: () => socket,
    reconnect: { baseDelayMs: 50, maxDelayMs: 100, jitterRatio: 0 },
    heartbeatIntervalMs: 1_000,
    pongTimeoutMs: 100,
    handlers: { onRecord: () => undefined },
  });
  stream.start();
  socket.open();
  await flush();
  scheduler.advance(1_000);
  assert.equal(socket.sent.at(-1), "ping");
  scheduler.advance(100);
  assert.equal(socket.closes.at(-1)?.reason, "pong timeout");
  assert.equal(stream.status().state, "degraded");
  stream.stop();
});

test("failed sequence recovery drops the uncertain update and never returns live", async () => {
  const scheduler = new ManualScheduler();
  const socket = new FakeSocket();
  const records: BitgetStreamRecord[] = [];
  const stream = new BitgetPublicStream({
    topics: [{ instType: "SPOT", channel: "books5", instId: "RNVDAUSDT" }],
    scheduler,
    socketFactory: () => socket,
    reconnect: { baseDelayMs: 100, maxDelayMs: 100, jitterRatio: 0 },
    backfill: async () => { throw new Error("REST unavailable"); },
    handlers: { onRecord: (record) => { records.push(record); } },
  });
  stream.start();
  socket.open();
  await flush();
  socket.message(JSON.stringify({ action: "snapshot", arg: { instType: "SPOT", channel: "books5", instId: "RNVDAUSDT" }, data: [{ seq: 1 }] }));
  socket.message(JSON.stringify({ action: "update", arg: { instType: "SPOT", channel: "books5", instId: "RNVDAUSDT" }, data: [{ seq: 3 }] }));
  await flush(20);
  assert.deepEqual(records.map((record) => record.sequence), [1]);
  assert.notEqual(stream.status().state, "live");
  assert.equal(socket.closes.at(-1)?.reason, "sequence gap backfill failed");
  stream.stop();
});

test("repeated connection construction failures open the stream circuit", () => {
  const scheduler = new ManualScheduler();
  const stream = new BitgetPublicStream({
    topics: [{ instType: "SPOT", channel: "ticker", instId: "RNVDAUSDT" }],
    scheduler,
    socketFactory: () => { throw new Error("offline"); },
    reconnect: { baseDelayMs: 10, maxDelayMs: 10, jitterRatio: 0 },
    circuitThreshold: 2,
    circuitCooldownMs: 1_000,
    handlers: { onRecord: () => undefined },
  });
  stream.start();
  assert.equal(stream.status().state, "degraded");
  scheduler.advance(10);
  assert.equal(stream.status().state, "open_circuit");
  assert.equal(stream.status().circuit.state, "open");
  stream.stop();
});
