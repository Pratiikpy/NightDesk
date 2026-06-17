import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const required = [
  "README.md",
  "SUBMISSION.md",
  "docs/BITGET_NATIVE_PROOF.md",
  "docs/PNL_CLAIM_STANDARD.md",
  "docs/CLAIM_LEDGER.md",
  "docs/SECURITY_BOUNDARIES.md",
  "EVALUATION_STANDARD.md",
];

export function runDocsCheck(): void {
  const rows = required.map((file) => ({ file, exists: existsSync(join(process.cwd(), file)) }));
  const stalePatterns = [
    { pattern: /\b(?:149|153|161|167|174)\/(?:149|153|161|167|174)\b/i, reason: "old test count" },
    { pattern: /\b(?:13|14) hard gates\b/i, reason: "old gate count" },
    { pattern: /\brisk[- ]free\b/i, reason: "risk-free overclaim" },
    { pattern: /\balways profitable\b/i, reason: "always-profitable overclaim" },
    { pattern: /\blive trade executed\b/i, reason: "live execution overclaim" },
  ];
  const stale: { file: string; reason: string; match: string }[] = [];
  for (const r of rows) {
    if (!r.exists) continue;
    const text = readFileSync(join(process.cwd(), r.file), "utf8");
    for (const s of stalePatterns) {
      const m = text.match(s.pattern);
      if (m) stale.push({ file: r.file, reason: s.reason, match: m[0] });
    }
  }
  const ok = rows.every((r) => r.exists) && stale.length === 0;
  writeFileSync(join(process.cwd(), "evidence", "docs-check.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ok, rows, stale }, null, 2) + "\n");
  console.log(`NIGHTDESK DOCS CHECK ${ok ? "PASS" : "FAIL"}`);
  for (const r of rows) console.log(`${r.exists ? "✓" : "✗"} ${r.file}`);
  for (const s of stale) console.log(`✗ ${s.file}: ${s.reason} (${s.match})`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("docs-check.ts")) runDocsCheck();
