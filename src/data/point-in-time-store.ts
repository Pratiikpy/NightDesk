import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { eventIdentityHash, type DataKind, type ProvenanceEvent } from "./provenance";

export interface AppendResult {
  status: "appended" | "duplicate";
  file: string;
}

function safePartition(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function jsonLines(file: string): ProvenanceEvent[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ProvenanceEvent);
}

function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(full);
  }
  return out.sort();
}

export class PointInTimeStore {
  private readonly identities = new Map<string, string>();

  constructor(private readonly root: string) {
    for (const file of filesUnder(root)) {
      for (const event of jsonLines(file)) this.registerExisting(event);
    }
  }

  private registerExisting(event: ProvenanceEvent): void {
    const identity = eventIdentityHash(event);
    const prior = this.identities.get(event.eventId);
    if (prior && prior !== identity) throw new Error(`conflicting persisted eventId: ${event.eventId}`);
    this.identities.set(event.eventId, identity);
  }

  partitionFile(event: ProvenanceEvent): string {
    return join(
      this.root,
      `kind=${safePartition(event.kind)}`,
      `source=${safePartition(event.source)}`,
      `date=${utcDay(event.receivedAt)}`,
      "events.jsonl",
    );
  }

  append(event: ProvenanceEvent): AppendResult {
    const identity = eventIdentityHash(event);
    const prior = this.identities.get(event.eventId);
    const file = this.partitionFile(event);
    if (prior) {
      if (prior !== identity) throw new Error(`eventId conflict: ${event.eventId}`);
      return { status: "duplicate", file };
    }
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
    this.identities.set(event.eventId, identity);
    return { status: "appended", file };
  }

  replay(options: {
    asOfReceivedAt: number;
    kinds?: DataKind[];
    instrument?: string;
    includeQuarantined?: boolean;
  }): ProvenanceEvent[] {
    const allowedKinds = options.kinds ? new Set(options.kinds) : null;
    const instrument = options.instrument?.toUpperCase();
    return filesUnder(this.root)
      .flatMap(jsonLines)
      .filter((event) => event.receivedAt <= options.asOfReceivedAt)
      .filter((event) => !allowedKinds || allowedKinds.has(event.kind))
      .filter((event) => !instrument || event.instrument === instrument)
      .filter((event) => options.includeQuarantined || event.quality.status !== "quarantined")
      .sort(
        (a, b) =>
          a.effectiveAt - b.effectiveAt ||
          a.receivedAt - b.receivedAt ||
          (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) ||
          a.eventId.localeCompare(b.eventId),
      );
  }
}
