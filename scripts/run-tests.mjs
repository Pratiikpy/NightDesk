// Portable test runner. Finds test files recursively and runs them through node:test + tsx.
//
// Why this exists: `node --test "test/**/*.test.ts"` only works where Node expands the glob itself
// (Node 21+). On Node 20 — what CI and most judges run — the quoted glob reaches Node as a literal
// path and nothing runs ("Could not find .../test/**/*.test.ts"). Discovering the files ourselves
// makes `npm test` behave identically on Node 18.18+/20/22 and on Windows or Linux, with no glob or
// shell dependency. Pass a filename suffix to filter (default ".test.ts").
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const suffix = process.argv[2] ?? ".test.ts";
const root = "test";

function find(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...find(full));
    else if (entry.name.endsWith(suffix)) out.push(full);
  }
  return out;
}

const files = find(root).sort();
if (files.length === 0) {
  console.error(`No test files ending in "${suffix}" under ${root}/`);
  process.exit(1);
}

const res = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
process.exit(res.status ?? 1);
