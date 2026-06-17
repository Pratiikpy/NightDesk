// Ledger attestation — Ed25519 signing of decision-cycle batches (Compliance Gatekeeper Pattern).
//
// WHY: in the institutional Compliance Gatekeeper Pattern, the research/decision agents hold no
// execution authority — they emit a trade intent, a deterministic risk layer (our 15 gates) approves
// it, and the approval + the full decision trace is written to an IMMUTABLE, signed audit ledger.
// This module is the "signed" part: it hashes a batch of CycleRecords and signs the hash with an
// Ed25519 key, so anyone can later prove the ledger was produced by this bot instance and has not
// been altered. Pure stdlib (node:crypto) — no dependency, no network. Signing never blocks trading.
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  createHash,
  type KeyObject,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface Keypair {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyPem: string;
}

export interface Attestation {
  algo: "ed25519";
  recordCount: number;
  recordsSha256: string; // sha256 over the canonical JSON of the records
  signatureHex: string; // Ed25519 signature over the recordsSha256 bytes
  publicKeyPem: string; // verify against this
  signedAt: string;
}

const defaultKeyFile = (): string => join(process.cwd(), "data", "ledger", "attestation_key.json");

/**
 * Load the Ed25519 keypair from disk, or generate + persist one on first use.
 * The private key lives under data/ (gitignored) — it is a secret and is never committed.
 */
export function loadOrCreateKeypair(file = defaultKeyFile()): Keypair {
  if (existsSync(file)) {
    const { privateKeyPem, publicKeyPem } = JSON.parse(readFileSync(file, "utf8")) as {
      privateKeyPem: string;
      publicKeyPem: string;
    };
    return { privateKey: createPrivateKey(privateKeyPem), publicKey: createPublicKey(publicKeyPem), publicKeyPem };
  }
  const kp = generateKeypair();
  mkdirSync(dirname(file), { recursive: true });
  const privateKeyPem = kp.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  writeFileSync(file, JSON.stringify({ privateKeyPem, publicKeyPem: kp.publicKeyPem }, null, 2));
  return kp;
}

/** Generate an ephemeral Ed25519 keypair (used by tests; persisted variant is loadOrCreateKeypair). */
export function generateKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  return { privateKey, publicKey, publicKeyPem };
}

/** Stable SHA-256 over a list of records. Order is preserved (append-only ledger). */
export function canonicalHash(records: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

/** Sign a batch of records. Returns a self-contained attestation (carries its own public key). */
export function attest(records: unknown[], keys?: Keypair): Attestation {
  const k = keys ?? loadOrCreateKeypair();
  const recordsSha256 = canonicalHash(records);
  const signatureHex = edSign(null, Buffer.from(recordsSha256, "hex"), k.privateKey).toString("hex");
  return {
    algo: "ed25519",
    recordCount: records.length,
    recordsSha256,
    signatureHex,
    publicKeyPem: k.publicKeyPem,
    signedAt: new Date().toISOString(),
  };
}

/** Verify an attestation against the records. False if the records changed or the signature is bad. */
export function verifyAttestation(records: unknown[], att: Attestation): boolean {
  if (canonicalHash(records) !== att.recordsSha256) return false;
  try {
    return edVerify(null, Buffer.from(att.recordsSha256, "hex"), createPublicKey(att.publicKeyPem), Buffer.from(att.signatureHex, "hex"));
  } catch {
    return false;
  }
}
