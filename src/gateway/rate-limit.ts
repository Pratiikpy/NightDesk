export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
  lockoutMs?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Bucket {
  timestamps: number[];
  lockedUntil: number;
}

export class GatewayRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`gateway rate limit exceeded; retry after ${retryAfterMs}ms`);
    this.name = "GatewayRateLimitError";
  }
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(scope: string, key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitDecision {
    if (!Number.isInteger(policy.limit) || policy.limit < 1) throw new Error("rate limit must be positive");
    if (!Number.isFinite(policy.windowMs) || policy.windowMs <= 0) throw new Error("rate window must be positive");
    const bucketKey = `${scope.trim()}\u0000${key.trim()}`;
    const bucket = this.buckets.get(bucketKey) ?? { timestamps: [], lockedUntil: 0 };
    bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < policy.windowMs);
    if (bucket.lockedUntil > now) {
      this.buckets.set(bucketKey, bucket);
      return { allowed: false, remaining: 0, retryAfterMs: bucket.lockedUntil - now };
    }
    bucket.lockedUntil = 0;
    if (bucket.timestamps.length >= policy.limit) {
      const retryAfterWindow = Math.max(1, policy.windowMs - (now - bucket.timestamps[0]!));
      const lockoutMs = Math.max(0, policy.lockoutMs ?? 0);
      bucket.lockedUntil = lockoutMs > 0 ? now + lockoutMs : 0;
      this.buckets.set(bucketKey, bucket);
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterWindow, lockoutMs) };
    }
    bucket.timestamps.push(now);
    this.buckets.set(bucketKey, bucket);
    return { allowed: true, remaining: policy.limit - bucket.timestamps.length, retryAfterMs: 0 };
  }

  enforce(scope: string, key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitDecision {
    const decision = this.consume(scope, key, policy, now);
    if (!decision.allowed) throw new GatewayRateLimitError(decision.retryAfterMs);
    return decision;
  }

  prune(now = Date.now(), maximumAgeMs = 60 * 60 * 1000): number {
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      const newest = bucket.timestamps.at(-1) ?? 0;
      if (bucket.lockedUntil <= now && now - newest > maximumAgeMs) {
        this.buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.buckets.size;
  }
}
