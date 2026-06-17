// Persistent recorder loop. `npm run record`. Every tick: collect → append JSONL → heartbeat.
// Restart-safe (append-only). Ctrl+C stops cleanly.
import { collect } from "../pegwatch/collect";
import { appendSnapshot } from "./store";

export async function record(intervalMs = 30_000): Promise<void> {
  console.log(`[recorder] starting — interval=${intervalMs}ms, Ctrl+C to stop`);
  let running = true;
  process.on("SIGINT", () => {
    running = false;
    console.log("\n[recorder] stopping after current tick…");
  });

  while (running) {
    const t0 = Date.now();
    try {
      const snap = await collect();
      const file = appendSnapshot(snap);
      const nonNormal = snap.rows.filter((r) => r.state && r.state !== "NORMAL").length;
      const depegEq = snap.rows.filter((r) => r.stateVsEquity && r.stateVsEquity !== "NORMAL").length;
      const triFlagged = snap.rows.filter((r) => r.triangulation?.flagged).length;
      const withBook = snap.rows.filter((r) => (r.rToken?.bookLevels ?? 0) > 0).length;
      console.log(
        `[${snap.isoTime}] ${snap.rows.length} rows → ${file} | book=${withBook}/${snap.rows.length} vsPerp-nn=${nonNormal} vsEQ-depeg=${depegEq} tri-flagged=${triFlagged}`
      );
    } catch (e) {
      console.error("[recorder] tick error:", e);
    }
    if (!running) break;
    const elapsed = Date.now() - t0;
    await new Promise((r) => setTimeout(r, Math.max(0, intervalMs - elapsed)));
  }
  console.log("[recorder] stopped.");
  process.exit(0);
}
