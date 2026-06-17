import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function runOosStatus(): void {
  const file = join(process.cwd(), "evidence", "oos-daemon", "state.json");
  if (!existsSync(file)) {
    console.log("NIGHTDESK OOS STATUS: missing evidence/oos-daemon/state.json");
    process.exitCode = 1;
    return;
  }
  const state = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const ok = ["running", "stopped", "once_complete"].includes(String(state.status ?? "")) && Number(state.snapshotsRecorded ?? 0) > 0;
  console.log(`NIGHTDESK OOS STATUS ${ok ? "PASS" : "FAIL"}`);
  console.log(JSON.stringify(state, null, 2));
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("oos-status.ts")) runOosStatus();
