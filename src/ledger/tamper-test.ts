import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyAttestation, type Attestation } from "./attest";

const ledgerDir = () => join(process.cwd(), "data", "ledger");

function latestLedger(): string | null {
  const dir = ledgerDir();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  return files.length ? join(dir, files[files.length - 1]!) : null;
}

export function runLedgerTamperTest(file = latestLedger()): void {
  const failures: string[] = [];
  if (!file) {
    failures.push("no ledger file found; run npm run simulate or npm run judge first");
  } else {
    const sigFile = file.replace(/\.jsonl$/, ".sig.json");
    if (!existsSync(sigFile)) failures.push(`missing signature sidecar ${sigFile}`);
    else {
      const records = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
      const att = JSON.parse(readFileSync(sigFile, "utf8")) as Attestation;
      const checks = [
        { name: "one-byte mutation", records: records.map((r, i) => i === 0 ? { ...r, __tamper: true } : r), shouldVerify: false },
        { name: "deleted row", records: records.slice(1), shouldVerify: false },
        { name: "reordered rows", records: [...records].reverse(), shouldVerify: records.length <= 1 },
        { name: "duplicate row", records: records.length ? [records[0], ...records] : records, shouldVerify: false },
        { name: "wrong public key/signature", records, att: { ...att, signatureHex: "00".repeat(64) }, shouldVerify: false },
        { name: "original ledger", records, shouldVerify: true },
      ];
      for (const c of checks) {
        const valid = verifyAttestation(c.records, c.att ?? att);
        if (valid !== c.shouldVerify) failures.push(`${c.name}: expected verify=${c.shouldVerify}, got ${valid}`);
      }
    }
  }
  const ok = failures.length === 0;
  writeFileSync(join(process.cwd(), "evidence", "ledger-tamper-test.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ok, file, failures }, null, 2) + "\n");
  console.log(`NIGHTDESK LEDGER TAMPER TEST ${ok ? "PASS" : "FAIL"}`);
  for (const f of failures) console.log(`✗ ${f}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("tamper-test.ts")) runLedgerTamperTest(process.argv[2]);
