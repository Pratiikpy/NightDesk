// Append-only JSONL persistence. data/snapshots/YYYY-MM-DD.jsonl (gitignored).
// This file IS the publishable dataset + replay source.
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data", "snapshots");

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
