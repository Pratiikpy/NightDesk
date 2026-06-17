import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunEvent, RunTopic } from "./events";
import { RunBus } from "./bus";

export class RunLog {
  readonly events: RunEvent[] = [];
  readonly bus = new RunBus();

  append(event: RunEvent, topic?: RunTopic): void {
    const eventTopic = topic ?? event.topic;
    const stored = eventTopic ? ({ ...event, topic: eventTopic } as RunEvent) : event;
    this.events.push(stored);
    if (eventTopic) this.bus.publish(eventTopic, stored);
  }

  saveJsonl(file: string): string {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, this.events.map((e) => JSON.stringify(e)).join("\n") + (this.events.length ? "\n" : ""));
    return file;
  }
}
