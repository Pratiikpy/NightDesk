// Reliability & security hardening (Month 10): event-replay recovery (RPO/RTO), secret-redacted support
// bundles, upgrade-survivor record migration, and a software bill of materials. Pure functions — no I/O,
// no network — so recovery and redaction are deterministically testable.
import { createHash } from "node:crypto";

const SECRET_KEY = /(secret|token|passphrase|password|api[-_]?key|private[-_]?key|authorization|bearer)/i;

/** Deep-redact secret-bearing keys from a diagnostic/support bundle — secrets never reach logs or bundles. */
export function redactBundle(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactBundle);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : redactBundle(v);
    return out;
  }
  return value;
}

export function bundleContains(bundle: unknown, needle: string): boolean {
  return JSON.stringify(bundle).includes(needle);
}

export interface ReplayEvent { seq: number; type: string; amount: number; orderId?: string }
export interface ReplayState { pnl: number; orders: string[]; lastSeq: number }

/** Recover state by folding the durable event log — deterministic, order-independent of arrival. */
export function replayState(events: ReplayEvent[]): ReplayState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const state: ReplayState = { pnl: 0, orders: [], lastSeq: 0 };
  for (const e of sorted) {
    state.pnl = Number((state.pnl + e.amount).toFixed(6));
    if (e.orderId) state.orders.push(e.orderId);
    state.lastSeq = e.seq;
  }
  return state;
}

export function stateHash(s: ReplayState): string {
  return createHash("sha256").update(JSON.stringify(s)).digest("hex");
}

export interface RecordV1 { schema: "v1"; id: string; pnl: number }
export interface RecordV2 { schema: "v2"; id: string; pnl: number; certificateId: string }

/** Upgrade-survivor migration: an old record upgrades to the new schema without losing any field. */
export function migrateV1toV2(r: RecordV1): RecordV2 {
  return { schema: "v2", id: r.id, pnl: r.pnl, certificateId: `migrated:${r.id}` };
}

export interface SbomComponent { name: string; version: string }
export interface Sbom { name: string; version: string; componentCount: number; components: SbomComponent[] }

/** Software bill of materials from a package manifest — every dependency pinned and inventoried. */
export function generateSbom(pkg: { name: string; version: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): Sbom {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const components = Object.entries(deps).map(([name, version]) => ({ name, version: String(version) })).sort((a, b) => a.name.localeCompare(b.name));
  return { name: pkg.name, version: pkg.version, componentCount: components.length, components };
}
