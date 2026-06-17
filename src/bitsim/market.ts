// Adapters: turn recorded PegWatch snapshots into BitSim market quotes for replay.
import { readFileSync } from "node:fs";
import type { Snapshot, LegQuote } from "../pegwatch/collect";
import type { MarketQuote } from "./types";

function legToQuote(leg: LegQuote | null): MarketQuote | null {
  if (!leg) return null;
  const funding = (leg as { funding?: number | null }).funding ?? null;
  // Synthesize bid/ask from mid/last when a snapshot lacks explicit quotes (older recordings),
  // so the fill engine always has a touch to fill against.
  const fallback = leg.mid ?? leg.last;
  return {
    symbol: leg.symbol,
    bid: leg.bid ?? fallback,
    ask: leg.ask ?? fallback,
    last: leg.last ?? leg.mid,
    book: leg.book,
    fundingRate: funding,
  };
}

/** Map of symbol → MarketQuote for every leg in a snapshot. */
export function quotesFromSnapshot(snap: Snapshot): Map<string, MarketQuote> {
  const m = new Map<string, MarketQuote>();
  for (const row of snap.rows) {
    for (const leg of [row.rToken, row.perp, row.ondo]) {
      const q = legToQuote(leg);
      if (q) m.set(q.symbol, q);
    }
  }
  return m;
}

/** Load a recorded snapshots JSONL file into Snapshot[] (skips malformed lines). */
export function loadSnapshots(file: string): Snapshot[] {
  const text = readFileSync(file, "utf8");
  const out: Snapshot[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as Snapshot);
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}
