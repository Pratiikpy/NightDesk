import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "data-cache");

export function runCacheIntegrity(): void {
  mkdirSync(OUT, { recursive: true });
  const dir = join(process.cwd(), "data", "snapshots");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort() : [];
  const rows = files.map((file) => {
    const full = join(dir, file);
    const st = statSync(full);
    const sessionDate = file.replace(/\.jsonl$/, "");
    const today = new Date().toISOString().slice(0, 10);
    return {
      file: `data/snapshots/${file}`,
      bytes: st.size,
      modified_at: st.mtime.toISOString(),
      session_date: sessionDate,
      cache_status: sessionDate >= today ? "forming_or_recent_do_not_treat_as_settled" : "settled_replay_fixture",
    };
  });
  writeFileSync(join(OUT, "cache-integrity-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + "\n");
  writeFileSync(
    join(OUT, "cache-integrity-report.md"),
    [
      "# Cache Integrity Report",
      "",
      "Rule: settled historical snapshot files can be reused for deterministic replay; today's or future-dated files must not be treated as settled OOS proof.",
      "",
      "| File | Bytes | Status |",
      "|---|---:|---|",
      ...rows.map((r) => `| ${r.file} | ${r.bytes} | ${r.cache_status} |`),
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK CACHE INTEGRITY COMPLETE: ${join(OUT, "cache-integrity-report.md")}`);
}

if (process.argv[1]?.endsWith("cache-integrity.ts")) runCacheIntegrity();
