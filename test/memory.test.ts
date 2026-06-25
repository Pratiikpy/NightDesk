import { test } from "node:test";
import assert from "node:assert/strict";
import { ConvergenceMemory, premiumBucket, recencyWeight } from "../src/memory/convergence";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("premiumBucket encodes direction + magnitude band", () => {
  assert.equal(premiumBucket(-0.3), "long/0-0.5");
  assert.equal(premiumBucket(-0.9), "long/0.5-1");
  assert.equal(premiumBucket(1.5), "short/1-2");
  assert.equal(premiumBucket(2.5), "short/2+");
});

test("recencyWeight halves every half-life", () => {
  const hl = 30;
  assert.ok(Math.abs(recencyWeight(0, hl) - 1) < 1e-9);
  assert.ok(Math.abs(recencyWeight(30 * 86_400_000, hl) - 0.5) < 1e-9);
  assert.ok(Math.abs(recencyWeight(60 * 86_400_000, hl) - 0.25) < 1e-9);
});

test("recall on an unseen key returns an empty prior", () => {
  const m = new ConvergenceMemory();
  const p = m.recall("NVDA", "short/1-2");
  assert.equal(p.n, 0);
  assert.equal(p.confidence, 0);
  assert.match(p.summary, /no prior/);
});

test("recall is recency+importance weighted (recent converged dominates an old miss)", () => {
  const now = Date.UTC(2026, 5, 15);
  const m = new ConvergenceMemory();
  // old, far in the past, did NOT converge
  m.add({ ticker: "NVDA", ts: now - 200 * 86_400_000, bucket: "short/2+", premiumPct: 2.5, converged: false, narrowingPp: -0.1, pnlPct: -0.1, holdBars: 0 });
  // recent, converged
  m.add({ ticker: "NVDA", ts: now - 1 * 86_400_000, bucket: "short/2+", premiumPct: 2.5, converged: true, narrowingPp: 1.2, pnlPct: 1.2, holdBars: 4 });
  const p = m.recall("NVDA", "short/2+", now);
  assert.equal(p.n, 2);
  assert.ok(p.convergedRatePct > 80, `recent converged should dominate, got ${p.convergedRatePct}`);
  assert.ok(p.avgNarrowingPp > 0);
});

test("memory excludes expired and future observations", () => {
  const now = Date.UTC(2026, 5, 15);
  const memory = new ConvergenceMemory();
  memory.add({ ticker: "NVDA", ts: now - 10, expiresAt: now - 1, bucket: "long/1-2", premiumPct: -1.2, converged: true, narrowingPp: 1, pnlPct: 1, holdBars: 2, evidenceRef: "expired" });
  memory.add({ ticker: "NVDA", ts: now + 1, expiresAt: now + 100, bucket: "long/1-2", premiumPct: -1.2, converged: true, narrowingPp: 1, pnlPct: 1, holdBars: 2, evidenceRef: "future" });
  assert.equal(memory.recall("NVDA", "long/1-2", now).n, 0);
});

test("memory deduplicates evidence and verifies persisted checksums", () => {
  const memory = new ConvergenceMemory();
  const input = { ticker: "NVDA", ts: 1_000, bucket: "long/1-2", premiumPct: -1.2, converged: true, narrowingPp: 1, pnlPct: 1, holdBars: 2, evidenceRef: "ledger:abc" };
  memory.add(input);
  memory.add(input);
  assert.equal(memory.entries.length, 1);
  assert.match(memory.entries[0]!.sourceHash, /^[a-f0-9]{64}$/);
  const file = join(mkdtempSync(join(tmpdir(), "nightdesk-memory-")), "memory.json");
  memory.save(file);
  const loaded = ConvergenceMemory.load(file);
  assert.equal(loaded.integrityStatus, "ok");
  assert.equal(loaded.entries.length, 1);
  writeFileSync(file, '{"schema":"nightdesk.memory.v2","checksum":"bad","entries":[]}');
  const corrupt = ConvergenceMemory.load(file);
  assert.equal(corrupt.integrityStatus, "corrupt");
  assert.equal(corrupt.entries.length, 0);
});
