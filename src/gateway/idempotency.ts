import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export type IdempotencyStatus = "running" | "completed" | "failed";

export interface IdempotencyRecord {
  version: 1;
  scope: string;
  key: string;
  requestHash: string;
  runId: string;
  status: IdempotencyStatus;
  updatedAt: string;
  result?: unknown;
  error?: string;
}

export interface IdempotentResult<T> {
  runId: string;
  value: T;
  replayed: boolean;
}

export class IdempotencyConflictError extends Error {
  constructor(scope: string, key: string) {
    super(`idempotency key ${scope}:${key} was already used with a different request`);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyRecoveryRequiredError extends Error {
  constructor(scope: string, key: string, status: IdempotencyStatus) {
    super(`idempotency key ${scope}:${key} is ${status}; operator reconciliation is required`);
    this.name = "IdempotencyRecoveryRequiredError";
  }
}

interface InFlight<T = unknown> {
  requestHash: string;
  promise: Promise<IdempotentResult<T>>;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const rows = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
  return `{${rows.join(",")}}`;
}

export function idempotencyRequestHash(request: unknown): string {
  return createHash("sha256").update(canonical(request)).digest("hex");
}

export class FileIdempotencyRegistry {
  private readonly latest = new Map<string, IdempotencyRecord>();
  private readonly inFlight = new Map<string, InFlight>();

  constructor(readonly journalPath: string) {
    this.load();
  }

  private compound(scope: string, key: string): string {
    const normalizedScope = scope.trim();
    const normalizedKey = key.trim();
    if (!normalizedScope || !normalizedKey) throw new Error("idempotency scope and key are required");
    if (normalizedScope.length > 128 || normalizedKey.length > 256) {
      throw new Error("idempotency scope/key exceeds maximum length");
    }
    return `${normalizedScope}\u0000${normalizedKey}`;
  }

  private load(): void {
    if (!existsSync(this.journalPath)) return;
    const lines = readFileSync(this.journalPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const record = JSON.parse(line) as IdempotencyRecord;
        if (record.version !== 1 || !record.scope || !record.key || !record.requestHash || !record.runId) continue;
        this.latest.set(this.compound(record.scope, record.key), record);
      } catch {
        throw new Error(`invalid idempotency journal record in ${this.journalPath}`);
      }
    }
  }

  private append(record: IdempotencyRecord): void {
    mkdirSync(dirname(this.journalPath), { recursive: true });
    appendFileSync(this.journalPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", flush: true });
    this.latest.set(this.compound(record.scope, record.key), record);
  }

  get(scope: string, key: string): IdempotencyRecord | undefined {
    return this.latest.get(this.compound(scope, key));
  }

  async execute<T>(params: {
    scope: string;
    key: string;
    request: unknown;
    operation: (context: { runId: string }) => Promise<T>;
    runId?: string;
  }): Promise<IdempotentResult<T>> {
    const compound = this.compound(params.scope, params.key);
    const requestHash = idempotencyRequestHash(params.request);
    const active = this.inFlight.get(compound);
    if (active) {
      if (active.requestHash !== requestHash) {
        throw new IdempotencyConflictError(params.scope, params.key);
      }
      const result = (await active.promise) as IdempotentResult<T>;
      return { ...result, replayed: true };
    }

    const prior = this.latest.get(compound);
    if (prior) {
      if (prior.requestHash !== requestHash) {
        throw new IdempotencyConflictError(params.scope, params.key);
      }
      if (prior.status === "completed") {
        return { runId: prior.runId, value: prior.result as T, replayed: true };
      }
      throw new IdempotencyRecoveryRequiredError(params.scope, params.key, prior.status);
    }

    const runId = params.runId ?? `run_${randomUUID()}`;
    const promise = (async (): Promise<IdempotentResult<T>> => {
      this.append({
        version: 1,
        scope: params.scope,
        key: params.key,
        requestHash,
        runId,
        status: "running",
        updatedAt: new Date().toISOString(),
      });
      try {
        const value = await params.operation({ runId });
        this.append({
          version: 1,
          scope: params.scope,
          key: params.key,
          requestHash,
          runId,
          status: "completed",
          updatedAt: new Date().toISOString(),
          result: value,
        });
        return { runId, value, replayed: false };
      } catch (error) {
        this.append({
          version: 1,
          scope: params.scope,
          key: params.key,
          requestHash,
          runId,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        this.inFlight.delete(compound);
      }
    })();
    this.inFlight.set(compound, { requestHash, promise });
    return promise;
  }
}
