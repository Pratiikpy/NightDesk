import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collect } from "../pegwatch/collect";
import { appendNormalizedSnapshot, appendSnapshot } from "../recorder/store";
import { runForwardPaperDaemon } from "../execution/forward-paper-daemon";
import { runDailyPromoter } from "../agent/daily-promoter";
import { runOosReport } from "../research/session-study";

const OUT = join(process.cwd(), "evidence", "oos-daemon");
const STOP_FILE = join(OUT, "STOP");

interface DaemonState {
  startedAt: string;
  lastTickAt?: string;
  lastRefreshAt?: string;
  ticks: number;
  refreshes: number;
  snapshotsRecorded: number;
  targetSessions: number;
  intervalMs: number;
  refreshMs: number;
  status: "running" | "stopped" | "once_complete" | "error";
  lastError?: string;
}

function argNumber(args: string[], name: string, fallback: number): number {
  const prefix = `${name}=`;
  const inline = args.find((a) => a.startsWith(prefix));
  const split = args.indexOf(name);
  const raw = inline ? inline.slice(prefix.length) : split >= 0 ? args[split + 1] : undefined;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function appendJsonl(file: string, value: unknown): void {
  writeFileSync(file, JSON.stringify(value) + "\n", { flag: "a" });
}

function writeState(state: DaemonState): void {
  writeFileSync(join(OUT, "state.json"), JSON.stringify(state, null, 2) + "\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countRecordedSessions(): number {
  const file = join(process.cwd(), "evidence", "oos", "session-summary.csv");
  if (!existsSync(file)) return 0;
  return Math.max(0, readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).length - 1);
}

async function recordTick(state: DaemonState): Promise<void> {
  const snap = await collect();
  const file = appendSnapshot(snap);
  const normalized = appendNormalizedSnapshot(snap);
  const nonNormal = snap.rows.filter((r) => r.state && r.state !== "NORMAL").length;
  const depegEq = snap.rows.filter((r) => r.stateVsEquity && r.stateVsEquity !== "NORMAL").length;
  state.ticks += 1;
  state.snapshotsRecorded += 1;
  state.lastTickAt = new Date().toISOString();
  appendJsonl(join(OUT, "record-log.jsonl"), {
    timestamp: state.lastTickAt,
    file,
    tokens: snap.rows.length,
    snapshotTime: snap.isoTime,
    vsPerpNonNormal: nonNormal,
    vsEquityDepeg: depegEq,
    normalizedEvents: normalized.appended,
    normalizedDuplicates: normalized.duplicates,
  });
}

function refreshEvidence(state: DaemonState): void {
  runForwardPaperDaemon([]);
  runDailyPromoter();
  runOosReport([]);
  state.refreshes += 1;
  state.lastRefreshAt = new Date().toISOString();
  appendJsonl(join(OUT, "refresh-log.jsonl"), {
    timestamp: state.lastRefreshAt,
    refreshes: state.refreshes,
    sessions: countRecordedSessions(),
  });
}

export async function runOosBackground(args: string[] = []): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const once = args.includes("--once");
  const intervalMs = argNumber(args, "--interval-ms", 300_000);
  const refreshMs = argNumber(args, "--refresh-ms", 1_800_000);
  const targetSessions = argNumber(args, "--target-sessions", 20);
  const state: DaemonState = {
    startedAt: new Date().toISOString(),
    ticks: 0,
    refreshes: 0,
    snapshotsRecorded: 0,
    targetSessions,
    intervalMs,
    refreshMs,
    status: "running",
  };
  writeState(state);

  let running = true;
  process.on("SIGINT", () => {
    running = false;
  });
  process.on("SIGTERM", () => {
    running = false;
  });

  let nextRefreshAt = 0;
  while (running) {
    try {
      await recordTick(state);
      const now = Date.now();
      if (once || now >= nextRefreshAt) {
        refreshEvidence(state);
        nextRefreshAt = now + refreshMs;
      }
      state.status = once ? "once_complete" : "running";
      writeState(state);
      if (once || existsSync(STOP_FILE) || countRecordedSessions() >= targetSessions) break;
    } catch (e) {
      state.status = "error";
      state.lastError = e instanceof Error ? e.message : String(e);
      appendJsonl(join(OUT, "error-log.jsonl"), { timestamp: new Date().toISOString(), error: state.lastError });
      writeState(state);
    }
    await sleep(intervalMs);
  }

  state.status = once ? "once_complete" : "stopped";
  writeState(state);
}

if (process.argv[1]?.endsWith("oos-background.ts")) {
  runOosBackground(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
