import type { ComponentState, RunEvent, RunTopic } from "./events";

export interface RunMessage<T extends RunEvent = RunEvent> {
  readonly topic: RunTopic;
  readonly event: Readonly<T>;
}

export class RunBus {
  private readonly subscribers = new Map<RunTopic, Set<(message: RunMessage) => void>>();
  private readonly cache = new Map<RunTopic, RunMessage>();

  publish<T extends RunEvent>(topic: RunTopic, event: T): RunMessage<T> {
    const frozen = Object.freeze({ ...event, topic }) as Readonly<T>;
    const message = Object.freeze({ topic, event: frozen }) as RunMessage<T>;
    this.cache.set(topic, message as RunMessage);
    for (const cb of this.subscribers.get(topic) ?? []) cb(message as RunMessage);
    return message;
  }

  subscribe(topic: RunTopic, cb: (message: RunMessage) => void): () => void {
    const set = this.subscribers.get(topic) ?? new Set<(message: RunMessage) => void>();
    set.add(cb);
    this.subscribers.set(topic, set);
    return () => set.delete(cb);
  }

  latest(topic: RunTopic): RunMessage | undefined {
    return this.cache.get(topic);
  }
}

const allowedTransitions: Record<ComponentState, ComponentState[]> = {
  PRE_INITIALIZED: ["READY", "FAULTED"],
  READY: ["STARTING", "DISPOSED", "FAULTED"],
  STARTING: ["RUNNING", "DEGRADED", "FAULTED"],
  RUNNING: ["DEGRADED", "STOPPING", "FAULTED"],
  DEGRADED: ["RUNNING", "STOPPING", "FAULTED"],
  STOPPING: ["STOPPED", "FAULTED"],
  STOPPED: ["STARTING", "DISPOSED"],
  FAULTED: ["DISPOSED"],
  DISPOSED: [],
};

export class ComponentLifecycle {
  state: ComponentState = "PRE_INITIALIZED";

  constructor(readonly component: string) {}

  transition(to: ComponentState): { from: ComponentState; to: ComponentState } {
    const from = this.state;
    if (!allowedTransitions[from].includes(to)) {
      throw new Error(`invalid ${this.component} lifecycle transition ${from} -> ${to}`);
    }
    this.state = to;
    return { from, to };
  }
}
