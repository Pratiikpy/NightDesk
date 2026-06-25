export const NIGHTDESK_PROTOCOL_VERSION = "nightdesk.v1" as const;

export const GATEWAY_METHODS = [
  "health.live",
  "health.ready",
  "status.get",
  "market.snapshot",
  "certificate.issue",
  "intent.evaluate",
  "paper.execute",
  "live.preview",
  "run.get",
  "run.cancel",
  "evidence.get",
] as const;

export type GatewayMethod = (typeof GATEWAY_METHODS)[number];

export type GatewayCapability =
  | "health:read"
  | "market:read"
  | "certificate:issue"
  | "intent:evaluate"
  | "paper:execute"
  | "live:preview"
  | "run:read"
  | "run:cancel"
  | "evidence:read";

export const METHOD_CAPABILITY: Record<GatewayMethod, GatewayCapability> = {
  "health.live": "health:read",
  "health.ready": "health:read",
  "status.get": "health:read",
  "market.snapshot": "market:read",
  "certificate.issue": "certificate:issue",
  "intent.evaluate": "intent:evaluate",
  "paper.execute": "paper:execute",
  "live.preview": "live:preview",
  "run.get": "run:read",
  "run.cancel": "run:cancel",
  "evidence.get": "evidence:read",
};

export const SIDE_EFFECTING_METHODS = new Set<GatewayMethod>([
  "paper.execute",
  "live.preview",
  "run.cancel",
]);

export interface GatewayRequest<T = Record<string, unknown>> {
  protocolVersion: typeof NIGHTDESK_PROTOCOL_VERSION;
  requestId: string;
  agentId: string;
  sessionId: string;
  method: GatewayMethod;
  params: T;
  idempotencyKey?: string;
  deadlineAt?: string;
}

export interface GatewayAcceptedResponse {
  protocolVersion: typeof NIGHTDESK_PROTOCOL_VERSION;
  requestId: string;
  runId: string;
  status: "accepted";
  stateVersion: number;
}

export interface GatewayFinalResponse<T = unknown> {
  protocolVersion: typeof NIGHTDESK_PROTOCOL_VERSION;
  requestId: string;
  runId: string;
  status: "ok" | "error" | "canceled";
  stateVersion: number;
  result?: T;
  error?: { code: string; message: string };
}

export interface GatewayRunEvent<T = unknown> {
  protocolVersion: typeof NIGHTDESK_PROTOCOL_VERSION;
  seq: number;
  stateVersion: number;
  runId: string;
  correlationId: string;
  causationId?: string;
  type: string;
  timestamp: string;
  payload: T;
}

export class GatewayRequestValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid gateway request: ${issues.join("; ")}`);
    this.name = "GatewayRequestValidationError";
  }
}

const METHODS = new Set<string>(GATEWAY_METHODS);

function nonEmptyBounded(value: unknown, name: string, max: number, issues: string[]): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${name} is required`);
    return false;
  }
  if (value.length > max) {
    issues.push(`${name} exceeds ${max} characters`);
    return false;
  }
  return true;
}

export function parseGatewayRequest(value: unknown, now = Date.now()): GatewayRequest {
  const issues: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GatewayRequestValidationError(["request must be an object"]);
  }
  const row = value as Record<string, unknown>;
  if (row.protocolVersion !== NIGHTDESK_PROTOCOL_VERSION) {
    issues.push(`unsupported protocolVersion ${String(row.protocolVersion)}`);
  }
  nonEmptyBounded(row.requestId, "requestId", 128, issues);
  nonEmptyBounded(row.agentId, "agentId", 128, issues);
  nonEmptyBounded(row.sessionId, "sessionId", 128, issues);
  if (typeof row.method !== "string" || !METHODS.has(row.method)) {
    issues.push(`unknown method ${String(row.method)}`);
  }
  if (!row.params || typeof row.params !== "object" || Array.isArray(row.params)) {
    issues.push("params must be an object");
  }
  if (row.idempotencyKey !== undefined) {
    nonEmptyBounded(row.idempotencyKey, "idempotencyKey", 256, issues);
  }
  if (typeof row.method === "string" && METHODS.has(row.method)) {
    const method = row.method as GatewayMethod;
    if (SIDE_EFFECTING_METHODS.has(method) && !row.idempotencyKey) {
      issues.push(`idempotencyKey is required for ${method}`);
    }
  }
  if (row.deadlineAt !== undefined) {
    const deadline = typeof row.deadlineAt === "string" ? Date.parse(row.deadlineAt) : Number.NaN;
    if (!Number.isFinite(deadline)) issues.push("deadlineAt must be an ISO timestamp");
    else if (deadline <= now) issues.push("deadlineAt has expired");
  }
  if (issues.length > 0) throw new GatewayRequestValidationError(issues);
  return {
    protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
    requestId: (row.requestId as string).trim(),
    agentId: (row.agentId as string).trim(),
    sessionId: (row.sessionId as string).trim(),
    method: row.method as GatewayMethod,
    params: row.params as Record<string, unknown>,
    ...(row.idempotencyKey ? { idempotencyKey: (row.idempotencyKey as string).trim() } : {}),
    ...(row.deadlineAt ? { deadlineAt: row.deadlineAt as string } : {}),
  };
}
