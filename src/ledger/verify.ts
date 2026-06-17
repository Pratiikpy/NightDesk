// `npm run verify` — independently re-verify the Ed25519-signed audit ledger.
//
// This turns "every decision is signed" from a claim into something a judge can run: it reads a
// ledger file (data/ledger/<day>.jsonl) + its signature sidecar (<day>.sig.json), re-hashes the
// records, and verifies the Ed25519 signature against the public key embedded in the attestation.
// It also runs a TAMPER CHECK — mutating any record must flip verification to false — proving the
// signature actually binds the content (not a no-op). Pure stdlib, no network.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyAttestation, canonicalHash, type Attestation } from "./attest";

export interface LedgerVerification {
  file: string;
  recordCount: number;
  signaturePresent: boolean;
  hashMatch: boolean;
  signatureValid: boolean;
  tamperEvident: boolean; // mutating a record flips verification to false
  signedAt: string | null;
  publicKeyFingerprint: string | null;
}

const fingerprint = (pem: string): string => createHash("sha256").update(pem).digest("hex").slice(0, 16);

/** Verify one ledger .jsonl file against its .sig.json attestation sidecar. */
export function verifyLedgerFile(jsonlFile: string): LedgerVerification {
  const sigFile = jsonlFile.replace(/\.jsonl$/, ".sig.json");
  const records = readFileSync(jsonlFile, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as unknown);
  const out: LedgerVerification = {
    file: jsonlFile,
    recordCount: records.length,
    signaturePresent: existsSync(sigFile),
    hashMatch: false,
    signatureValid: false,
    tamperEvident: false,
    signedAt: null,
    publicKeyFingerprint: null,
  };
  if (!out.signaturePresent) return out;
  const att = JSON.parse(readFileSync(sigFile, "utf8")) as Attestation;
  out.signedAt = att.signedAt;
  out.publicKeyFingerprint = fingerprint(att.publicKeyPem);
  out.hashMatch = canonicalHash(records) === att.recordsSha256;
  out.signatureValid = verifyAttestation(records, att);
  // Tamper check: altering any record must invalidate the signature.
  if (records.length) {
    const mutated = records.map((r) => ({ ...(r as Record<string, unknown>) }));
    mutated[0] = { ...mutated[0], __tamper: Date.now() };
    out.tamperEvident = !verifyAttestation(mutated, att);
  } else {
    out.tamperEvident = true; // nothing to tamper with
  }
  return out;
}

export function printLedgerVerification(file?: string): void {
  const dir = join(process.cwd(), "data", "ledger");
  let files: string[] = [];
  if (file) files = [file];
  else if (existsSync(dir)) files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().map((f) => join(dir, f));
  console.log("\nNightDesk — ledger verification (Ed25519 · Compliance Gatekeeper audit trail)\n");
  if (!files.length) {
    console.log("No ledger files in data/ledger/. Run `npm run simulate` first to produce a signed ledger.");
    return;
  }
  let verified = 0;
  let invalid = 0;
  let unsigned = 0;
  for (const f of files) {
    try {
      const v = verifyLedgerFile(f);
      if (!v.signaturePresent) {
        unsigned++;
        console.log(`⚠ UNSIGNED ${v.file}`);
        console.log(`    records=${v.recordCount}  (legacy ledger written before attestation was enabled — no .sig.json)`);
        continue;
      }
      const ok = v.signatureValid && v.tamperEvident;
      if (ok) verified++;
      else invalid++;
      console.log(`${ok ? "✓ VALID  " : "✗ INVALID"} ${v.file}`);
      console.log(`    records=${v.recordCount}  signature=${v.signatureValid ? "valid" : "INVALID"}  hashMatch=${v.hashMatch}  tamper-evident=${v.tamperEvident}`);
      if (v.signedAt) console.log(`    signedAt=${v.signedAt}  pubkey#${v.publicKeyFingerprint}`);
    } catch (e) {
      invalid++;
      console.log(`✗ ERROR  ${f}: ${(e as Error).message}`);
    }
  }
  console.log(
    `\n${verified} signed & verified, ${invalid} invalid, ${unsigned} unsigned (legacy). Reproduce independently: re-hash the JSONL records, verify the Ed25519 signature against the embedded public key. Altering any record invalidates the signature.`
  );
}
