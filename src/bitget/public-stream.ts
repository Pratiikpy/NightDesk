import { perpBook, perpTicker, spotBook, spotTicker } from "./client";
import { reconnectDelay, SequenceContinuity, StreamCircuitBreaker, type CircuitSnapshot, type ReconnectPolicyOptions } from "../data/stream-runtime";

export const BITGET_PUBLIC_WS = "wss://ws.bitget.com/v2/ws/public";

export type BitgetStreamChannel = "ticker" | "books5";
export type BitgetStreamInstrumentType = "SPOT" | "USDT-FUTURES";

export interface BitgetStreamTopic {
  instType: BitgetStreamInstrumentType;
  channel: BitgetStreamChannel;
  instId: string;
}

export interface BitgetStreamRecord {
  stream: string;
  topic: BitgetStreamTopic;
  action: "snapshot" | "update" | "backfill";
  sequence: number | null;
  sourceTs: number | null;
  receivedAt: number;
  payload: Record<string, unknown>;
}

export interface StreamGapNotice {
  stream: string;
  expected: number | null;
  actual: number | null;
  reason: "sequence_gap" | "sequence_regression" | "reconnect_backfill";
}

export interface PublicStreamHandlers {
  onRecord(record: BitgetStreamRecord): void | Promise<void>;
  onGap?(gap: StreamGapNotice): void | Promise<void>;
  onState?(status: BitgetPublicStreamStatus): void;
  onError?(error: Error): void;
}

export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = (url: string) => SocketLike;

export interface TimerScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const systemScheduler: TimerScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type StreamRuntimeState = "idle" | "connecting" | "backfilling" | "live" | "degraded" | "open_circuit" | "stopped";

export interface BitgetPublicStreamStatus {
  state: StreamRuntimeState;
  connectionAttempt: number;
  reconnects: number;
  records: number;
  gaps: number;
  lastMessageAt: number | null;
  lastBackfillAt: number | null;
  nextReconnectAt: number | null;
  circuit: CircuitSnapshot;
}

export interface BitgetPublicStreamOptions {
  topics: BitgetStreamTopic[];
  handlers: PublicStreamHandlers;
  socketFactory?: SocketFactory;
  scheduler?: TimerScheduler;
  reconnect?: ReconnectPolicyOptions;
  heartbeatIntervalMs?: number;
  pongTimeoutMs?: number;
  circuitThreshold?: number;
  circuitCooldownMs?: number;
  random?: () => number;
  backfill?: (topic: BitgetStreamTopic, signal: AbortSignal) => Promise<BitgetStreamRecord[]>;
}

function topicKey(topic: BitgetStreamTopic): string {
  return `${topic.instType}|${topic.channel}|${topic.instId}`;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function defaultSocketFactory(url: string): SocketLike {
  const Constructor = (globalThis as { WebSocket?: new (target: string) => SocketLike }).WebSocket;
  if (!Constructor) throw new Error("this Node runtime does not expose WebSocket");
  return new Constructor(url);
}

export function parseBitgetPublicMessage(message: unknown, receivedAt = Date.now()): BitgetStreamRecord[] {
  if (!message || typeof message !== "object") return [];
  const row = message as { arg?: Record<string, unknown>; action?: unknown; data?: unknown };
  const arg = row.arg;
  if (!arg || !Array.isArray(row.data)) return [];
  const instType = String(arg.instType ?? "").toUpperCase();
  const channel = String(arg.channel ?? "");
  const instId = String(arg.instId ?? "");
  if (!(["SPOT", "USDT-FUTURES"] as string[]).includes(instType)) return [];
  if (!(["ticker", "books5"] as string[]).includes(channel) || !instId) return [];
  const topic = { instType: instType as BitgetStreamInstrumentType, channel: channel as BitgetStreamChannel, instId };
  return row.data
    .filter((payload): payload is Record<string, unknown> => !!payload && typeof payload === "object")
    .map((payload) => ({
      stream: topicKey(topic),
      topic,
      action: row.action === "update" ? "update" : "snapshot",
      sequence: finiteNumber(payload.seq ?? payload.sequence ?? payload.version),
      sourceTs: finiteNumber(payload.ts ?? payload.timestamp),
      receivedAt,
      payload,
    }));
}

export async function restBackfill(topic: BitgetStreamTopic, signal: AbortSignal): Promise<BitgetStreamRecord[]> {
  if (signal.aborted) throw signal.reason ?? new Error("backfill aborted");
  const receivedAt = Date.now();
  let payload: Record<string, unknown>;
  if (topic.channel === "ticker") {
    const ticker = topic.instType === "SPOT" ? await spotTicker(topic.instId) : await perpTicker(topic.instId);
    payload = { ...ticker };
  } else {
    const book = topic.instType === "SPOT" ? await spotBook(topic.instId, 15) : await perpBook(topic.instId, 15);
    payload = { ...book };
  }
  if (signal.aborted) throw signal.reason ?? new Error("backfill aborted");
  return [{ stream: topicKey(topic), topic, action: "backfill", sequence: null, sourceTs: finiteNumber(payload.ts), receivedAt, payload }];
}

export class BitgetPublicStream {
  private readonly scheduler: TimerScheduler;
  private readonly socketFactory: SocketFactory;
  private readonly reconnect: ReconnectPolicyOptions;
  private readonly heartbeatIntervalMs: number;
  private readonly pongTimeoutMs: number;
  private readonly random: () => number;
  private readonly backfill: NonNullable<BitgetPublicStreamOptions["backfill"]>;
  private readonly circuit: StreamCircuitBreaker;
  private readonly continuity = new SequenceContinuity();
  private socket: SocketLike | null = null;
  private reconnectTimer: unknown = null;
  private heartbeatTimer: unknown = null;
  private pongTimer: unknown = null;
  private backfillAbort: AbortController | null = null;
  private stopped = false;
  private messageChain = Promise.resolve();
  private runtime: Omit<BitgetPublicStreamStatus, "circuit"> = {
    state: "idle",
    connectionAttempt: 0,
    reconnects: 0,
    records: 0,
    gaps: 0,
    lastMessageAt: null,
    lastBackfillAt: null,
    nextReconnectAt: null,
  };

  constructor(private readonly options: BitgetPublicStreamOptions) {
    if (!options.topics.length) throw new Error("at least one stream topic is required");
    this.scheduler = options.scheduler ?? systemScheduler;
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.reconnect = options.reconnect ?? { baseDelayMs: 500, maxDelayMs: 30_000, jitterRatio: 0.2 };
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
    this.pongTimeoutMs = options.pongTimeoutMs ?? 3_000;
    this.random = options.random ?? Math.random;
    this.backfill = options.backfill ?? restBackfill;
    this.circuit = new StreamCircuitBreaker(options.circuitThreshold ?? 5, options.circuitCooldownMs ?? 30_000);
  }

  status(): BitgetPublicStreamStatus {
    return { ...this.runtime, circuit: this.circuit.snapshot(this.scheduler.now()) };
  }

  start(): void {
    if (this.runtime.state !== "idle" && this.runtime.state !== "stopped") return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.backfillAbort?.abort(new Error("stream stopped"));
    this.backfillAbort = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "stopped");
    this.setState("stopped");
  }

  private emitStatus(): void {
    this.options.handlers.onState?.(this.status());
  }

  private setState(state: StreamRuntimeState): void {
    this.runtime.state = state;
    this.emitStatus();
  }

  private connect(): void {
    if (this.stopped) return;
    const now = this.scheduler.now();
    if (!this.circuit.allow(now)) {
      this.setState("open_circuit");
      const retryAt = this.circuit.snapshot(now).retryAt!;
      this.scheduleConnect(Math.max(1, retryAt - now));
      return;
    }
    this.runtime.connectionAttempt++;
    this.runtime.nextReconnectAt = null;
    this.setState("connecting");
    try {
      const socket = this.socketFactory(BITGET_PUBLIC_WS);
      this.socket = socket;
      socket.onopen = () => { void this.onOpen(socket); };
      socket.onmessage = (event) => this.onMessage(socket, event.data);
      socket.onclose = () => this.onDisconnected(socket, new Error("public stream closed"));
      socket.onerror = () => this.onDisconnected(socket, new Error("public stream transport error"));
    } catch (error) {
      this.onDisconnected(null, error as Error);
    }
  }

  private async onOpen(socket: SocketLike): Promise<void> {
    if (this.stopped || this.socket !== socket) return;
    this.circuit.success();
    socket.send(JSON.stringify({ op: "subscribe", args: this.options.topics.map((topic) => ({ ...topic })) }));
    if (this.runtime.reconnects > 0) {
      this.setState("backfilling");
      for (const topic of this.options.topics) {
        if (this.stopped || this.socket !== socket) return;
        await this.emitGap({ stream: topicKey(topic), expected: this.continuity.lastSequence(topicKey(topic)), actual: null, reason: "reconnect_backfill" });
        const recovered = await this.backfillTopic(topic);
        if (!recovered) {
          socket.close(4001, "reconnect backfill failed");
          return;
        }
        this.continuity.reset(topicKey(topic));
      }
    }
    if (this.stopped || this.socket !== socket) return;
    this.setState("live");
    this.armHeartbeat(socket);
  }

  private onMessage(socket: SocketLike, raw: unknown): void {
    if (this.stopped || this.socket !== socket) return;
    this.runtime.lastMessageAt = this.scheduler.now();
    this.clearPongTimer();
    const text = typeof raw === "string" ? raw : String(raw);
    if (text === "pong") return;
    if (text === "ping") {
      socket.send("pong");
      return;
    }
    this.messageChain = this.messageChain
      .then(async () => {
        let message: unknown;
        try { message = JSON.parse(text); } catch { throw new Error("invalid public stream JSON"); }
        for (const record of parseBitgetPublicMessage(message, this.scheduler.now())) await this.processRecord(record);
      })
      .catch((error) => this.options.handlers.onError?.(error as Error));
  }

  private async processRecord(record: BitgetStreamRecord): Promise<void> {
    if (record.sequence != null) {
      const result = this.continuity.observe(record.stream, record.sequence);
      if (result.status === "regression") {
        this.runtime.gaps++;
        await this.emitGap({ stream: record.stream, expected: result.expected, actual: result.actual, reason: "sequence_regression" });
        return;
      }
      if (result.status === "gap") {
        this.runtime.gaps++;
        this.setState("backfilling");
        await this.emitGap({ stream: record.stream, expected: result.expected, actual: result.actual, reason: "sequence_gap" });
        const recovered = await this.backfillTopic(record.topic);
        if (!recovered) {
          this.continuity.reset(record.stream);
          this.socket?.close(4001, "sequence gap backfill failed");
          return;
        }
        this.continuity.reset(record.stream, record.sequence);
        this.setState("live");
      }
    }
    this.runtime.records++;
    await this.options.handlers.onRecord(record);
  }

  private async emitGap(gap: StreamGapNotice): Promise<void> {
    await this.options.handlers.onGap?.(gap);
  }

  private async backfillTopic(topic: BitgetStreamTopic): Promise<boolean> {
    this.backfillAbort?.abort(new Error("superseded backfill"));
    const controller = new AbortController();
    this.backfillAbort = controller;
    try {
      const records = await this.backfill(topic, controller.signal);
      for (const record of records) {
        this.runtime.records++;
        await this.options.handlers.onRecord(record);
      }
      this.runtime.lastBackfillAt = this.scheduler.now();
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        this.setState("degraded");
        this.options.handlers.onError?.(error as Error);
      }
      return false;
    } finally {
      if (this.backfillAbort === controller) this.backfillAbort = null;
    }
  }

  private armHeartbeat(socket: SocketLike): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = this.scheduler.setTimeout(() => {
      if (this.stopped || this.socket !== socket) return;
      socket.send("ping");
      this.pongTimer = this.scheduler.setTimeout(() => {
        if (this.socket === socket) socket.close(4000, "pong timeout");
      }, this.pongTimeoutMs);
      this.armHeartbeat(socket);
    }, this.heartbeatIntervalMs);
  }

  private onDisconnected(socket: SocketLike | null, error: Error): void {
    if (this.stopped || (socket && this.socket !== socket)) return;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    }
    this.socket = null;
    this.clearTimers();
    this.circuit.failure(this.scheduler.now());
    this.options.handlers.onError?.(error);
    this.runtime.reconnects++;
    const circuit = this.circuit.snapshot(this.scheduler.now());
    const delay = circuit.state === "open"
      ? Math.max(1, circuit.retryAt! - this.scheduler.now())
      : reconnectDelay(Math.max(0, this.runtime.reconnects - 1), this.reconnect, this.random);
    this.setState(circuit.state === "open" ? "open_circuit" : "degraded");
    this.scheduleConnect(delay);
  }

  private scheduleConnect(delay: number): void {
    if (this.stopped) return;
    if (this.reconnectTimer) this.scheduler.clearTimeout(this.reconnectTimer);
    this.runtime.nextReconnectAt = this.scheduler.now() + delay;
    this.reconnectTimer = this.scheduler.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.emitStatus();
  }

  private clearPongTimer(): void {
    if (this.pongTimer) this.scheduler.clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) this.scheduler.clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) this.scheduler.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.clearHeartbeatTimer();
    this.clearPongTimer();
  }
}
