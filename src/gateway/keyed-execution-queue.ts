export class QueueDrainingError extends Error {
  constructor() {
    super("execution queue is draining; new work is not accepted");
    this.name = "QueueDrainingError";
  }
}

export class QueueCapacityError extends Error {
  constructor(key: string) {
    super(`execution lane ${key} is at capacity`);
    this.name = "QueueCapacityError";
  }
}

export class QueueTaskTimeoutError extends Error {
  constructor(key: string, timeoutMs: number) {
    super(`execution lane ${key} task timed out after ${timeoutMs}ms`);
    this.name = "QueueTaskTimeoutError";
  }
}

interface QueueEntry<T> {
  sequence: number;
  priority: number;
  timeoutMs?: number;
  task: (signal: AbortSignal) => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

interface Lane {
  active: boolean;
  entries: QueueEntry<unknown>[];
}

export interface LaneSnapshot {
  key: string;
  active: boolean;
  queued: number;
}

export class KeyedExecutionQueue {
  private readonly lanes = new Map<string, Lane>();
  private sequence = 0;
  private draining = false;
  private drainWaiters: Array<() => void> = [];

  constructor(readonly maxQueuedPerKey = 100) {
    if (!Number.isInteger(maxQueuedPerKey) || maxQueuedPerKey < 1) {
      throw new Error("maxQueuedPerKey must be a positive integer");
    }
  }

  enqueue<T>(
    key: string,
    task: (signal: AbortSignal) => Promise<T>,
    options: { priority?: number; timeoutMs?: number } = {},
  ): Promise<T> {
    const normalized = key.trim();
    if (!normalized) return Promise.reject(new Error("execution lane key is required"));
    if (this.draining) return Promise.reject(new QueueDrainingError());
    const lane = this.lanes.get(normalized) ?? { active: false, entries: [] };
    if (lane.entries.length >= this.maxQueuedPerKey) {
      return Promise.reject(new QueueCapacityError(normalized));
    }
    this.lanes.set(normalized, lane);
    return new Promise<T>((resolve, reject) => {
      lane.entries.push({
        sequence: this.sequence++,
        priority: Number.isFinite(options.priority) ? Math.trunc(options.priority ?? 0) : 0,
        timeoutMs:
          options.timeoutMs != null && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
            ? Math.trunc(options.timeoutMs)
            : undefined,
        task,
        resolve,
        reject,
      } as QueueEntry<unknown>);
      lane.entries.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
      void this.drainLane(normalized, lane);
    });
  }

  private async drainLane(key: string, lane: Lane): Promise<void> {
    if (lane.active) return;
    lane.active = true;
    try {
      while (lane.entries.length > 0) {
        const entry = lane.entries.shift()!;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        if (entry.timeoutMs) {
          timer = setTimeout(() => {
            timedOut = true;
            controller.abort(new QueueTaskTimeoutError(key, entry.timeoutMs!));
          }, entry.timeoutMs);
        }
        try {
          const value = await entry.task(controller.signal);
          if (timedOut) entry.reject(new QueueTaskTimeoutError(key, entry.timeoutMs!));
          else entry.resolve(value);
        } catch (error) {
          entry.reject(timedOut ? new QueueTaskTimeoutError(key, entry.timeoutMs!) : error);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
    } finally {
      lane.active = false;
      if (lane.entries.length === 0) this.lanes.delete(key);
      this.notifyDrainIfIdle();
    }
  }

  snapshot(): LaneSnapshot[] {
    return [...this.lanes.entries()]
      .map(([key, lane]) => ({ key, active: lane.active, queued: lane.entries.length }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  isDraining(): boolean {
    return this.draining;
  }

  drain(): Promise<void> {
    this.draining = true;
    if (this.lanes.size === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.drainWaiters.push(resolve));
  }

  private notifyDrainIfIdle(): void {
    if (!this.draining || this.lanes.size > 0) return;
    const waiters = this.drainWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}

export function accountLaneKey(accountId: string): string {
  return `account:${accountId.trim()}`;
}

export function symbolLaneKey(accountId: string, symbol: string): string {
  return `${accountLaneKey(accountId)}:symbol:${symbol.trim().toUpperCase()}`;
}
