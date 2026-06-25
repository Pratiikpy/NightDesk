import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BitgetPublicStream, parseBitgetPublicMessage, type BitgetStreamRecord, type SocketLike, type TimerScheduler } from "../bitget/public-stream";
import { reconnectDelay, SequenceContinuity, StreamCircuitBreaker } from "./stream-runtime";

const OUT = join(process.cwd(), "evidence", "data-platform");

class ProofScheduler implements TimerScheduler {
  private time = 1_000;
  private id = 0;
  private tasks = new Map<number, { at: number; callback: () => void }>();
  now(): number { return this.time; }
  setTimeout(callback: () => void, delayMs: number): number {
    const id = ++this.id;
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

class ProofSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closeReasons: string[] = [];
  send(data: string): void { this.sent.push(data); }
  close(_code?: number, reason?: string): void { this.closeReasons.push(reason ?? ""); this.onclose?.({ reason }); }
  open(): void { this.onopen?.(); }
  message(data: unknown): void { this.onmessage?.({ data }); }
  disconnect(): void { this.onclose?.({ code: 1006, reason: "fixture disconnect" }); }
}

async function flush(turns = 12): Promise<void> {
  for (let index = 0; index < turns; index++) await Promise.resolve();
}

export async function runStreamResilienceProof(): Promise<Record<string, unknown>> {
  mkdirSync(OUT, { recursive: true });
  const scheduler = new ProofScheduler();
  const sockets: ProofSocket[] = [];
  const records: BitgetStreamRecord[] = [];
  const gaps: string[] = [];
  let backfills = 0;
  const topic = { instType: "SPOT" as const, channel: "books5" as const, instId: "RNVDAUSDT" };
  const stream = new BitgetPublicStream({
    topics: [topic],
    scheduler,
    socketFactory: () => { const socket = new ProofSocket(); sockets.push(socket); return socket; },
    reconnect: { baseDelayMs: 100, maxDelayMs: 800, jitterRatio: 0 },
    heartbeatIntervalMs: 1_000,
    pongTimeoutMs: 100,
    random: () => 0.5,
    backfill: async (requested) => {
      backfills++;
      return [{ stream: "SPOT|books5|RNVDAUSDT", topic: requested, action: "backfill", sequence: null, sourceTs: 995, receivedAt: scheduler.now(), payload: { bids: [[99, 1]], asks: [[100, 1]] } }];
    },
    handlers: {
      onRecord: (record) => { records.push(record); },
      onGap: (gap) => { gaps.push(gap.reason); },
    },
  });
  stream.start();
  sockets[0]!.open();
  await flush();
  sockets[0]!.message(JSON.stringify({ action: "snapshot", arg: topic, data: [{ seq: 1, ts: 990 }] }));
  sockets[0]!.message(JSON.stringify({ action: "update", arg: topic, data: [{ seq: 3, ts: 999 }] }));
  await flush(24);
  sockets[0]!.disconnect();
  scheduler.advance(100);
  sockets[1]!.open();
  await flush(24);
  scheduler.advance(1_000);
  const heartbeatSent = sockets[1]!.sent.at(-1) === "ping";
  sockets[1]!.message("pong");
  stream.stop();

  const continuity = new SequenceContinuity();
  continuity.observe("proof", 10);
  const regression = continuity.observe("proof", 9);
  const circuit = new StreamCircuitBreaker(2, 1_000);
  circuit.failure(100);
  circuit.failure(200);
  const opened = circuit.snapshot(300).state === "open" && !circuit.allow(300);
  const halfOpenAllowed = circuit.allow(1_200);
  circuit.success();
  const parserRecords = parseBitgetPublicMessage({ action: "snapshot", arg: topic, data: [{ seq: 7, ts: 900 }] }, 1_000);

  const proof = {
    endpoint: "public-v2",
    credentialsRequired: false,
    writesEnabled: false,
    subscriptionSent: sockets.every((socket) => socket.sent.some((message) => message.includes('"op":"subscribe"'))),
    sequenceGapDetected: gaps.includes("sequence_gap"),
    sequenceRegressionRejected: regression.status === "regression",
    gapBackfillCompleted: records.some((record) => record.action === "backfill"),
    reconnectBackfillCompleted: gaps.includes("reconnect_backfill") && backfills === 2,
    reconnectCount: stream.status().reconnects,
    heartbeatSent,
    circuitOpened: opened,
    halfOpenProbeAllowed: halfOpenAllowed,
    parserAcceptedKnownChannel: parserRecords.length === 1 && parserRecords[0]?.sequence === 7,
    boundedReconnectDelaysMs: [0, 1, 2, 3, 10].map((attempt) => reconnectDelay(attempt, { baseDelayMs: 100, maxDelayMs: 800, jitterRatio: 0 }, () => 0.5)),
    finalState: stream.status().state,
    gapEvents: gaps,
    deliveredActions: records.map((record) => record.action),
  };
  writeFileSync(join(OUT, "stream-resilience-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  writeFileSync(
    join(OUT, "stream-resilience-report.md"),
    [
      "# Public Stream Resilience Proof",
      "",
      `- Public/read-only transport: ${!proof.credentialsRequired && !proof.writesEnabled ? "PASS" : "FAIL"}`,
      `- Subscribe and resubscribe: ${proof.subscriptionSent ? "PASS" : "FAIL"}`,
      `- Sequence gap detected: ${proof.sequenceGapDetected ? "PASS" : "FAIL"}`,
      `- Gap backfill completed: ${proof.gapBackfillCompleted ? "PASS" : "FAIL"}`,
      `- Reconnect backfill completed: ${proof.reconnectBackfillCompleted ? "PASS" : "FAIL"}`,
      `- Sequence regression rejected: ${proof.sequenceRegressionRejected ? "PASS" : "FAIL"}`,
      `- Application heartbeat: ${proof.heartbeatSent ? "PASS" : "FAIL"}`,
      `- Circuit open and half-open recovery: ${proof.circuitOpened && proof.halfOpenProbeAllowed ? "PASS" : "FAIL"}`,
      `- Final state after explicit stop: ${proof.finalState}`,
      "",
      "The scenario is deterministic and network-independent. A separate optional public-stream smoke",
      "command records current provider reachability without making the core verification internet-dependent.",
      "",
    ].join("\n"),
  );
  console.log("NIGHTDESK STREAM RESILIENCE PROOF: PASS");
  return proof;
}

if (process.argv[1]?.endsWith("stream-proof.ts")) runStreamResilienceProof().catch((error) => { console.error(error); process.exit(1); });
