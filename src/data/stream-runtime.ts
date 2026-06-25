export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitSnapshot {
  state: CircuitState;
  failures: number;
  retryAt: number | null;
}

export class StreamCircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private halfOpenProbe = false;

  constructor(private readonly threshold: number, private readonly cooldownMs: number) {
    if (!Number.isSafeInteger(threshold) || threshold < 1) throw new Error("circuit threshold must be a positive integer");
    if (!Number.isFinite(cooldownMs) || cooldownMs < 1) throw new Error("circuit cooldown must be positive");
  }

  allow(now: number): boolean {
    if (this.openedAt == null) return true;
    if (now < this.openedAt + this.cooldownMs) return false;
    if (this.halfOpenProbe) return false;
    this.halfOpenProbe = true;
    return true;
  }

  success(): void {
    this.failures = 0;
    this.openedAt = null;
    this.halfOpenProbe = false;
  }

  failure(now: number): void {
    this.failures++;
    this.halfOpenProbe = false;
    if (this.failures >= this.threshold) this.openedAt = now;
  }

  snapshot(now: number): CircuitSnapshot {
    if (this.openedAt == null) return { state: "closed", failures: this.failures, retryAt: null };
    return {
      state: now >= this.openedAt + this.cooldownMs ? "half_open" : "open",
      failures: this.failures,
      retryAt: this.openedAt + this.cooldownMs,
    };
  }
}

export interface ReconnectPolicyOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export function reconnectDelay(attempt: number, options: ReconnectPolicyOptions, random = Math.random): number {
  if (!Number.isSafeInteger(attempt) || attempt < 0) throw new Error("attempt must be a non-negative integer");
  if (options.baseDelayMs <= 0 || options.maxDelayMs < options.baseDelayMs) throw new Error("invalid reconnect delay bounds");
  if (options.jitterRatio < 0 || options.jitterRatio > 1) throw new Error("jitterRatio must be between 0 and 1");
  const raw = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt);
  const jitter = raw * options.jitterRatio * (random() * 2 - 1);
  return Math.max(1, Math.round(raw + jitter));
}

export type ContinuityResult =
  | { status: "first" | "contiguous"; expected: number | null; actual: number }
  | { status: "gap" | "regression"; expected: number; actual: number };

export class SequenceContinuity {
  private readonly last = new Map<string, number>();

  observe(stream: string, sequence: number): ContinuityResult {
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("sequence must be a non-negative safe integer");
    const prior = this.last.get(stream);
    if (prior == null) {
      this.last.set(stream, sequence);
      return { status: "first", expected: null, actual: sequence };
    }
    if (sequence === prior + 1) {
      this.last.set(stream, sequence);
      return { status: "contiguous", expected: prior + 1, actual: sequence };
    }
    if (sequence <= prior) return { status: "regression", expected: prior + 1, actual: sequence };
    this.last.set(stream, sequence);
    return { status: "gap", expected: prior + 1, actual: sequence };
  }

  reset(stream: string, sequence?: number): void {
    if (sequence == null) this.last.delete(stream);
    else this.last.set(stream, sequence);
  }

  lastSequence(stream: string): number | null {
    return this.last.get(stream) ?? null;
  }
}
