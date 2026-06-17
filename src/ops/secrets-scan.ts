import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const skipDirs = new Set(["node_modules", ".git", ".research", ".playwright-mcp"]);
const skipExt = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".lock"]);
const patterns = [
  { name: "private_key_literal", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { name: "aws_access_key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "hardcoded_bitget_secret", re: /BITGET_(?:SECRET_KEY|PASSPHRASE)\s*=\s*['"][^'"]+['"]/i },
  { name: "generic_secret_assignment", re: /\b(?:secret|api[_-]?key|passphrase)\b\s*[:=]\s*['"][A-Za-z0-9_./+=-]{24,}['"]/i },
];

const allowedRuntimeSecretFiles = new Set([
  // Generated locally by src/ledger/attest.ts for demo ledger signing.
  // It is intentionally under data/ and should not be committed or submitted as a credential.
  "data/ledger/attestation_key.json",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const item of readdirSync(dir)) {
    if (skipDirs.has(item)) continue;
    const full = join(dir, item);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const lower = item.toLowerCase();
      const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
      if (!skipExt.has(ext) && st.size < 2_000_000) out.push(full);
    }
  }
  return out;
}

export function runSecretsScan(): void {
  const root = process.cwd();
  const findings: { file: string; pattern: string; line: number }[] = [];
  const allowedRuntimeSecrets: { file: string; reason: string }[] = [];
  for (const file of walk(root)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    if (rel === ".env" || rel.startsWith("data/snapshots/")) continue;
    if (allowedRuntimeSecretFiles.has(rel)) {
      allowedRuntimeSecrets.push({ file: rel, reason: "local runtime Ed25519 ledger signing key; not a Bitget/API credential" });
      continue;
    }
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const p of patterns) {
        if (p.re.test(line) && !/your-|example|placeholder|env_key|process\.env/i.test(line)) findings.push({ file: rel, pattern: p.name, line: i + 1 });
      }
    });
  }
  const ok = findings.length === 0;
  writeFileSync(join(root, "evidence", "secrets-scan.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ok, findings, allowedRuntimeSecrets }, null, 2) + "\n");
  console.log(`NIGHTDESK SECRETS SCAN ${ok ? "PASS" : "FAIL"}`);
  for (const a of allowedRuntimeSecrets) console.log(`allowed-runtime-secret ${a.file}: ${a.reason}`);
  if (findings.length) for (const f of findings) console.log(`${f.file}:${f.line} ${f.pattern}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("secrets-scan.ts")) runSecretsScan();
