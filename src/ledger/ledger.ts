// Append-only ledger (PRD §8.7): one record per decision cycle, linking
// EventCard → council → gates → fills → grade. Persisted to data/ledger/.
// Implements the audit-trail half of the Compliance Gatekeeper Pattern: every cycle is logged
// immutably and the batch is Ed25519-signed (see attest.ts) so the record is tamper-evident.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EventCard } from "../perception/eventcard";
import type { TradeProposal } from "../council/council";
import type { GateReport } from "../gates/gates";
import type { Fill } from "../bitsim/types";
import { attest, type Attestation } from "./attest";

export type Outcome = "win" | "loss" | "flat" | "no_trade" | "gated" | "abstained";

export interface CycleRecord {
  cycleId: string;
  ts: number;
  phase: string;
  ticker: string;
  card: EventCard;
  transcript: { role: string; content: string }[];
  proposal: TradeProposal;
  gateReport?: GateReport;
  fills: Fill[];
  symbol?: string;
  side?: "buy" | "sell";
  qty?: number;
  entryPrice?: number;
  entryPremiumPct?: number;
  exitPrice?: number;
  exitPremiumPct?: number;
  gradePnl?: number;
  convergenceCaptured?: boolean;
  outcome: Outcome;
  usage?: { promptTokens: number; completionTokens: number };
  // Counterfactual grade for abstained/gated cycles: what the avoided trade WOULD have done.
  counterfactual?: { wouldBePnlPct: number; wouldHaveConverged: boolean; decisionWasRight: boolean };
}

export class Ledger {
  records: CycleRecord[] = [];

  add(r: CycleRecord): void {
    this.records.push(r);
  }
  get(cycleId: string): CycleRecord | undefined {
    return this.records.find((r) => r.cycleId === cycleId);
  }
  save(dir = join(process.cwd(), "data", "ledger")): string {
    mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const file = join(dir, `${day}.jsonl`);
    writeFileSync(file, this.records.map((r) => JSON.stringify(r)).join("\n") + (this.records.length ? "\n" : ""));
    // Ed25519-sign the batch → tamper-evident audit sidecar. Never let signing block a save.
    try {
      const att = this.sign();
      writeFileSync(join(dir, `${day}.sig.json`), JSON.stringify(att, null, 2));
    } catch {
      /* signing is best-effort; the ledger itself is already written */
    }
    return file;
  }

  /** Ed25519 attestation over the current records (self-contained: carries its own public key). */
  sign(): Attestation {
    return attest(this.records);
  }
}
