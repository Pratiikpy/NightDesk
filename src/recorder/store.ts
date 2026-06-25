// Append-only JSONL persistence. data/snapshots/YYYY-MM-DD.jsonl (gitignored).
// This file IS the publishable dataset + replay source.
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "../pegwatch/collect";
import { PointInTimeStore } from "../data/point-in-time-store";
import { normalizeSnapshot } from "../data/snapshot-normalizer";

const DATA_DIR = join(process.cwd(), "data", "snapshots");
const NORMALIZED_DIR = join(process.cwd(), "data", "normalized");
let normalizedStore: PointInTimeStore | null = null;

export function snapshotFileForToday(): string {
  const day = new Date().toISOString().slice(0, 10);
  return join(DATA_DIR, `${day}.jsonl`);
}

export function appendSnapshot(obj: unknown): string {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = snapshotFileForToday();
  appendFileSync(file, JSON.stringify(obj) + "\n");
  return file;
}

export function appendNormalizedSnapshot(snapshot: Snapshot): { appended: number; duplicates: number } {
  const store = normalizedStore ??= new PointInTimeStore(NORMALIZED_DIR);
  let appended = 0;
  let duplicates = 0;
  for (const event of normalizeSnapshot(snapshot)) {
    if (store.append(event).status === "appended") appended++;
    else duplicates++;
  }
  return { appended, duplicates };
}
