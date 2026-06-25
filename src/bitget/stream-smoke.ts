import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BitgetPublicStream, type BitgetPublicStreamStatus, type BitgetStreamRecord, type StreamGapNotice } from "./public-stream";

const OUT = join(process.cwd(), "evidence", "data-platform");

export async function runPublicStreamSmoke(durationMs = 12_000): Promise<Record<string, unknown>> {
  mkdirSync(OUT, { recursive: true });
  const records: BitgetStreamRecord[] = [];
  const gaps: StreamGapNotice[] = [];
  const statuses: BitgetPublicStreamStatus[] = [];
  const errors: string[] = [];
  let finish: (() => void) | null = null;
  const complete = new Promise<void>((resolve) => { finish = resolve; });
  const stream = new BitgetPublicStream({
    topics: [
      { instType: "SPOT", channel: "ticker", instId: "RNVDAUSDT" },
      { instType: "SPOT", channel: "books5", instId: "RNVDAUSDT" },
    ],
    handlers: {
      onRecord: (record) => {
        records.push(record);
        if (new Set(records.map((row) => row.topic.channel)).size >= 2) finish?.();
      },
      onGap: (gap) => { gaps.push(gap); },
      onState: (status) => { statuses.push(status); },
      onError: (error) => { errors.push(error.message); },
    },
  });
  stream.start();
  const timeout = setTimeout(() => finish?.(), durationMs);
  await complete;
  clearTimeout(timeout);
  stream.stop();
  const channels = [...new Set(records.map((record) => record.topic.channel))];
  const result = {
    generatedAt: new Date().toISOString(),
    mode: "public-read-only",
    credentialsUsed: false,
    writesEnabled: false,
    success: channels.includes("ticker") && channels.includes("books5"),
    records: records.length,
    channels,
    gaps: gaps.length,
    finalStatus: stream.status(),
    errors: [...new Set(errors)].slice(0, 10),
  };
  writeFileSync(join(OUT, "live-stream-smoke.json"), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(join(OUT, "live-stream-records.jsonl"), records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : ""));
  writeFileSync(join(OUT, "live-stream-status.jsonl"), statuses.map((status) => JSON.stringify(status)).join("\n") + (statuses.length ? "\n" : ""));
  console.log(`NIGHTDESK PUBLIC STREAM SMOKE: ${result.success ? "PASS" : "UNAVAILABLE"} records=${records.length}`);
  return result;
}

if (process.argv[1]?.endsWith("stream-smoke.ts")) runPublicStreamSmoke().catch((error) => { console.error(error); process.exit(1); });
