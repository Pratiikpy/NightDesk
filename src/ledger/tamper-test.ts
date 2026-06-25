import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { attest, generateKeypair, verifyAttestation, type Attestation } from "./attest";

const ledgerDir = () => join(process.cwd(), "data", "ledger");

function latestLedger(): string | null {
  const dir = ledgerDir();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  return files.length ? join(dir, files[files.length - 1]!) : null;
}

// A representative signed batch, used when no POPULATED session ledger exists on disk (fresh clone, or a
// simulate run that produced no trades). It exercises the exact same attest/verify primitive as a real
// ledger, so the tamper-evidence demonstration is reliable on any machine — never vacuous on an empty file.
function syntheticLedger(): { records: Record<string, unknown>[]; att: Attestation } {
  const records: Record<string, unknown>[] = [
    { cycle: 1, ts: 1, ticker: "NVDA", decision: "TRADE", side: "buy", premiumPct: -0.97, certificateId: "demo-1" },
    { cycle: 2, ts: 2, ticker: "AAPL", decision: "NO_TRADE", reason: "below threshold", certificateId: "demo-2" },
    { cycle: 3, ts: 3, ticker: "TSLA", decision: "GATED", reason: "news catalyst", certificateId: "demo-3" },
  ];
  return { records, att: attest(records, generateKeypair()) };
}

export function runLedgerTamperTest(file = latestLedger()): void {
  const failures: string[] = [];
  let records: Record<string, unknown>[] | null = null;
  let att: Attestation | null = null;
  let source: string;

  // Prefer a real, POPULATED session ledger; fall back to a representative one so the demonstration is
  // never run against an empty/degenerate file (where mutations are no-ops and tampering can't show).
  const sigFile = file ? file.replace(/\.jsonl$/, ".sig.json") : null;
  if (file && sigFile && existsSync(sigFile)) {
    const recs = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    if (recs.length >= 1) {
      records = recs;
      att = JSON.parse(readFileSync(sigFile, "utf8")) as Attestation;
      source = file;
    }
  }
  if (!records || !att) {
    const syn = syntheticLedger();
    records = syn.records;
    att = syn.att;
    source = "synthetic representative ledger (no populated session ledger on disk)";
  } else {
    source = file!;
  }

  const checks = [
    { name: "one-byte mutation", records: records.map((r, i) => (i === 0 ? { ...r, __tamper: true } : r)), shouldVerify: false },
    { name: "deleted row", records: records.slice(1), shouldVerify: false },
    { name: "reordered rows", records: [...records].reverse(), shouldVerify: records.length <= 1 },
    { name: "duplicate row", records: records.length ? [records[0], ...records] : records, shouldVerify: false },
    { name: "wrong public key/signature", records, att: { ...att, signatureHex: "00".repeat(64) }, shouldVerify: false },
    { name: "original ledger", records, shouldVerify: true },
  ];
  for (const c of checks) {
    const valid = verifyAttestation(c.records, (c as { att?: Attestation }).att ?? att);
    if (valid !== c.shouldVerify) failures.push(`${c.name}: expected verify=${c.shouldVerify}, got ${valid}`);
  }

  const ok = failures.length === 0;
  writeFileSync(join(process.cwd(), "evidence", "ledger-tamper-test.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ok, source, recordCount: records.length, failures }, null, 2) + "\n");
  console.log(`NIGHTDESK LEDGER TAMPER TEST ${ok ? "PASS" : "FAIL"}  (source: ${source}, ${records.length} records)`);
  for (const f of failures) console.log(`✗ ${f}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("tamper-test.ts")) runLedgerTamperTest(process.argv[2]);
