import { createHash, randomUUID } from "node:crypto";
import { AgentCredentialStore } from "./auth";
import {
  METHOD_CAPABILITY,
  NIGHTDESK_PROTOCOL_VERSION,
  SIDE_EFFECTING_METHODS,
  parseGatewayRequest,
  type GatewayAcceptedResponse,
  type GatewayFinalResponse,
  type GatewayMethod,
  type GatewayRequest,
} from "./contracts";
import { FileIdempotencyRegistry } from "./idempotency";
import { KeyedExecutionQueue } from "./keyed-execution-queue";
import { SlidingWindowRateLimiter, type RateLimitPolicy } from "./rate-limit";
import { GatewayRuntimeStatus } from "./runtime-status";

export interface GatewayHandlerContext {
  runId: string;
  request: GatewayRequest;
  signal: AbortSignal;
}

export interface GatewayMethodHandler {
  execute: (context: GatewayHandlerContext) => Promise<unknown>;
  laneKey?: (request: GatewayRequest) => string;
  timeoutMs?: number;
}

export interface GatewaySubmission {
  accepted: GatewayAcceptedResponse;
  completion: Promise<GatewayFinalResponse>;
}

export interface TradingGatewayOptions {
  credentials: AgentCredentialStore;
  idempotency: FileIdempotencyRegistry;
  queue?: KeyedExecutionQueue;
  rateLimiter?: SlidingWindowRateLimiter;
  status?: GatewayRuntimeStatus;
  defaultRatePolicy?: RateLimitPolicy;
}

function stableRunId(request: GatewayRequest): string {
  if (!request.idempotencyKey) return `run_${randomUUID()}`;
  const identity = [request.agentId, request.method, request.idempotencyKey].join("\u0000");
  return `run_${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return "GATEWAY_ERROR";
  return error.name.replace(/Error$/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

export class TradingGateway {
  readonly queue: KeyedExecutionQueue;
  readonly rateLimiter: SlidingWindowRateLimiter;
  readonly status: GatewayRuntimeStatus;
  private readonly handlers = new Map<GatewayMethod, GatewayMethodHandler>();
  private readonly defaultRatePolicy: RateLimitPolicy;

  constructor(private readonly options: TradingGatewayOptions) {
    this.queue = options.queue ?? new KeyedExecutionQueue();
    this.rateLimiter = options.rateLimiter ?? new SlidingWindowRateLimiter();
    this.status = options.status ?? new GatewayRuntimeStatus(() => this.queue.snapshot());
    this.defaultRatePolicy = options.defaultRatePolicy ?? { limit: 60, windowMs: 60_000 };
    this.status.setComponent("gateway", "ready");
  }

  register(method: GatewayMethod, handler: GatewayMethodHandler): void {
    if (this.handlers.has(method)) throw new Error(`gateway handler already registered for ${method}`);
    this.handlers.set(method, handler);
  }

  submit(rawRequest: unknown, token: string, now = Date.now()): GatewaySubmission {
    const request = parseGatewayRequest(rawRequest, now);
    const principal = this.options.credentials.authenticate(request.agentId, token);
    this.options.credentials.authorize(principal, METHOD_CAPABILITY[request.method]);
    this.rateLimiter.enforce(request.method, principal.agentId, this.defaultRatePolicy, now);

    const snapshot = this.status.snapshot(now);
    if (!snapshot.accepting && !request.method.startsWith("health.") && request.method !== "status.get") {
      throw new Error("gateway is draining; new work is not accepted");
    }

    const runId = stableRunId(request);
    const accepted: GatewayAcceptedResponse = {
      protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
      requestId: request.requestId,
      runId,
      status: "accepted",
      stateVersion: snapshot.stateVersion,
    };
    const completion = this.complete(request, runId);
    return { accepted, completion };
  }

  private async complete(request: GatewayRequest, runId: string): Promise<GatewayFinalResponse> {
    try {
      const builtIn = this.builtInResult(request);
      const value = builtIn ?? (await this.executeHandler(request, runId));
      this.status.markSuccess();
      return {
        protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
        requestId: request.requestId,
        runId,
        status: "ok",
        stateVersion: this.status.snapshot().stateVersion,
        result: value,
      };
    } catch (error) {
      return {
        protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
        requestId: request.requestId,
        runId,
        status: "error",
        stateVersion: this.status.snapshot().stateVersion,
        error: {
          code: errorCode(error),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private builtInResult(request: GatewayRequest): unknown | undefined {
    if (request.method === "health.live") return { live: true };
    if (request.method === "health.ready") {
      const snapshot = this.status.snapshot();
      return { ready: snapshot.ready, degradedReasons: snapshot.degradedReasons };
    }
    if (request.method === "status.get") return this.status.snapshot();
    return undefined;
  }

  private async executeHandler(request: GatewayRequest, runId: string): Promise<unknown> {
    const handler = this.handlers.get(request.method);
    if (!handler) throw new Error(`no gateway handler registered for ${request.method}`);
    const operation = async (): Promise<unknown> => {
      const laneKey = handler.laneKey?.(request);
      if (!laneKey) return handler.execute({ runId, request, signal: new AbortController().signal });
      return this.queue.enqueue(
        laneKey,
        (signal) => handler.execute({ runId, request, signal }),
        { timeoutMs: handler.timeoutMs },
      );
    };
    if (!SIDE_EFFECTING_METHODS.has(request.method)) return operation();
    const idempotent = await this.options.idempotency.execute({
      scope: request.method,
      key: request.idempotencyKey!,
      request: { agentId: request.agentId, sessionId: request.sessionId, params: request.params },
      operation,
      runId,
    });
    return { value: idempotent.value, replayed: idempotent.replayed };
  }

  async drain(): Promise<void> {
    this.status.setAccepting(false);
    await this.queue.drain();
  }
}
