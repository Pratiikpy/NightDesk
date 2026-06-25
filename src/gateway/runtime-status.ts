import type { LaneSnapshot } from "./keyed-execution-queue";

export type ComponentHealth = "ready" | "degraded" | "failed" | "stopped";

export interface GatewayStatusSnapshot {
  version: 1;
  generatedAt: string;
  startedAt: string;
  uptimeMs: number;
  stateVersion: number;
  accepting: boolean;
  live: boolean;
  ready: boolean;
  degradedReasons: string[];
  components: Record<string, { status: ComponentHealth; detail?: string; updatedAt: string }>;
  lanes: LaneSnapshot[];
  lastSuccessAt?: string;
}

export class GatewayRuntimeStatus {
  private readonly startedAtMs: number;
  private accepting = true;
  private stateVersion = 1;
  private lastSuccessAt?: string;
  private readonly degradedReasons = new Set<string>();
  private readonly components = new Map<
    string,
    { status: ComponentHealth; detail?: string; updatedAt: string; required: boolean }
  >();

  constructor(
    private readonly lanes: () => LaneSnapshot[] = () => [],
    startedAt = Date.now(),
  ) {
    this.startedAtMs = startedAt;
  }

  setAccepting(accepting: boolean): void {
    if (this.accepting !== accepting) {
      this.accepting = accepting;
      this.stateVersion += 1;
    }
  }

  setComponent(
    name: string,
    status: ComponentHealth,
    options: { detail?: string; required?: boolean } = {},
  ): void {
    this.components.set(name, {
      status,
      ...(options.detail ? { detail: options.detail } : {}),
      updatedAt: new Date().toISOString(),
      required: options.required ?? true,
    });
    this.stateVersion += 1;
  }

  degrade(reason: string): void {
    if (!this.degradedReasons.has(reason)) {
      this.degradedReasons.add(reason);
      this.stateVersion += 1;
    }
  }

  recover(reason: string): void {
    if (this.degradedReasons.delete(reason)) this.stateVersion += 1;
  }

  markSuccess(at = new Date()): void {
    this.lastSuccessAt = at.toISOString();
    this.stateVersion += 1;
  }

  snapshot(now = Date.now()): GatewayStatusSnapshot {
    const requiredUnready = [...this.components.values()].some(
      (component) => component.required && component.status !== "ready",
    );
    const components = Object.fromEntries(
      [...this.components.entries()].map(([name, component]) => [
        name,
        {
          status: component.status,
          ...(component.detail ? { detail: component.detail } : {}),
          updatedAt: component.updatedAt,
        },
      ]),
    );
    return {
      version: 1,
      generatedAt: new Date(now).toISOString(),
      startedAt: new Date(this.startedAtMs).toISOString(),
      uptimeMs: Math.max(0, now - this.startedAtMs),
      stateVersion: this.stateVersion,
      accepting: this.accepting,
      live: true,
      ready: this.accepting && this.degradedReasons.size === 0 && !requiredUnready,
      degradedReasons: [...this.degradedReasons].sort(),
      components,
      lanes: this.lanes(),
      ...(this.lastSuccessAt ? { lastSuccessAt: this.lastSuccessAt } : {}),
    };
  }
}
