// Layered convergence memory — a simplified FinMem pattern (no embeddings/faiss).
// Stores GRADED convergence outcomes keyed by {ticker, premium bucket}, weighted by IMPORTANCE
// (bigger dislocations / outcomes matter more) and RECENCY (exponential decay), and recalls a prior
// the council can reason over. This turns the desk from stateless into context-accumulating —
// the "Persistent Memory" pillar of agentic trading. Pure + persisted; never blocks the loop.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

export interface MemoryEntry {
  id: string;
  ticker: string;
  ts: number; // when graded
  bucket: string; // direction + |premium| band, e.g. "short/1-2"
  premiumPct: number; // entry premium
  converged: boolean;
  narrowingPp: number; // how much |premium| shrank by exit
  pnlPct: number;
  holdBars: number;
  evidenceRef: string;
  sourceHash: string;
  expiresAt: number;
}

export type MemoryInput = Omit<MemoryEntry, "id" | "evidenceRef" | "sourceHash" | "expiresAt"> & Partial<Pick<MemoryEntry, "id" | "evidenceRef" | "sourceHash" | "expiresAt">>;

export interface MemoryPrior {
  ticker: string;
  bucket: string;
  n: number;
  convergedRatePct: number; // recency+importance weighted
  avgNarrowingPp: number;
  avgHoldBars: number;
  confidence: number; // 0..1, grows with sample size (bounded)
  summary: string; // human-readable line for the LLM council
}

/** Direction (long rToken if cheap / short if rich) + magnitude band. */
export function premiumBucket(premiumPct: number): string {
  const dir = premiumPct < 0 ? "long" : "short";
  const m = Math.abs(premiumPct);
  const band = m < 0.5 ? "0-0.5" : m < 1 ? "0.5-1" : m < 2 ? "1-2" : "2+";
  return `${dir}/${band}`;
}

const HALF_LIFE_DAYS = 30;
/** Exponential recency decay — a memory loses half its weight every `halfLifeDays`. */
export function recencyWeight(ageMs: number, halfLifeDays = HALF_LIFE_DAYS): number {
  return Math.pow(0.5, ageMs / 86_400_000 / halfLifeDays);
}
/** Bigger dislocations and bigger realized outcomes are more informative. */
export function importanceWeight(e: MemoryEntry): number {
  return 1 + Math.min(3, Math.abs(e.premiumPct)) + Math.min(2, Math.abs(e.pnlPct));
}

export class ConvergenceMemory {
  entries: MemoryEntry[] = [];
  integrityStatus: "ok" | "missing" | "corrupt" = "missing";

  add(input: MemoryInput): MemoryEntry {
    const numeric = [input.ts, input.premiumPct, input.narrowingPp, input.pnlPct, input.holdBars];
    if (!input.ticker || !input.bucket || numeric.some((value) => !Number.isFinite(value)) || input.holdBars < 0) throw new Error("invalid convergence memory entry");
    const evidenceRef = input.evidenceRef ?? `graded:${input.ticker}:${input.ts}`;
    const sourceHash = input.sourceHash ?? createHash("sha256").update(JSON.stringify({ evidenceRef, ticker: input.ticker, ts: input.ts, premiumPct: input.premiumPct, pnlPct: input.pnlPct })).digest("hex");
    const expiresAt = input.expiresAt ?? input.ts + 365 * 86_400_000;
    if (!(expiresAt > input.ts)) throw new Error("memory expiry must follow observation");
    const id = input.id ?? createHash("sha256").update(`${evidenceRef}|${sourceHash}`).digest("hex").slice(0, 24);
    if (this.entries.some((entry) => entry.id === id)) return this.entries.find((entry) => entry.id === id)!;
    const entry: MemoryEntry = { ...input, id, evidenceRef, sourceHash, expiresAt };
    this.entries.push(entry);
    this.integrityStatus = "ok";
    return entry;
  }

  /** Recency+importance-weighted prior for a {ticker, bucket}. */
  recall(ticker: string, bucket: string, now = Date.now()): MemoryPrior {
    const matches = this.entries.filter((e) => e.ticker === ticker && e.bucket === bucket && e.ts <= now && e.expiresAt >= now);
    if (!matches.length) {
      return { ticker, bucket, n: 0, convergedRatePct: 0, avgNarrowingPp: 0, avgHoldBars: 0, confidence: 0, summary: `no prior ${ticker} ${bucket} events` };
    }
    let wsum = 0;
    let convW = 0;
    let narrowW = 0;
    let holdW = 0;
    for (const e of matches) {
      const w = recencyWeight(now - e.ts) * importanceWeight(e);
      wsum += w;
      convW += w * (e.converged ? 1 : 0);
      narrowW += w * e.narrowingPp;
      holdW += w * e.holdBars;
    }
    const convergedRatePct = wsum ? Number(((convW / wsum) * 100).toFixed(1)) : 0;
    const avgNarrowingPp = wsum ? Number((narrowW / wsum).toFixed(3)) : 0;
    const avgHoldBars = wsum ? Number((holdW / wsum).toFixed(1)) : 0;
    const confidence = Number(Math.min(0.9, matches.length / (matches.length + 5)).toFixed(2));
    return {
      ticker,
      bucket,
      n: matches.length,
      convergedRatePct,
      avgNarrowingPp,
      avgHoldBars,
      confidence,
      summary: `memory: ${matches.length} past ${ticker} ${bucket} events → ${convergedRatePct}% converged, avg narrow ${avgNarrowingPp}pp, ~${avgHoldBars} bars (recency+importance weighted)`,
    };
  }

  save(file = defaultMemoryFile()): void {
    try {
      mkdirSync(dirname(file), { recursive: true });
      const serialized = JSON.stringify(this.entries);
      const checksum = createHash("sha256").update(serialized).digest("hex");
      writeFileSync(file, JSON.stringify({ schema: "nightdesk.memory.v2", checksum, entries: this.entries }));
    } catch {
      /* best-effort */
    }
  }

  static load(file = defaultMemoryFile()): ConvergenceMemory {
    const m = new ConvergenceMemory();
    try {
      if (!existsSync(file)) return m;
      const parsed = JSON.parse(readFileSync(file, "utf8")) as MemoryEntry[] | { schema?: string; checksum?: string; entries?: MemoryEntry[] };
      const rawEntries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(rawEntries)) throw new Error("memory entries missing");
      const migrated = rawEntries.map((entry) => m.add(entry));
      if (!Array.isArray(parsed)) {
        const checksum = createHash("sha256").update(JSON.stringify(migrated)).digest("hex");
        if (parsed.schema !== "nightdesk.memory.v2" || parsed.checksum !== checksum) throw new Error("memory checksum mismatch");
      }
      m.integrityStatus = "ok";
    } catch {
      m.entries = [];
      m.integrityStatus = "corrupt";
    }
    return m;
  }
}

export function defaultMemoryFile(): string {
  return join(process.cwd(), "data", "memory", "convergence.json");
}
