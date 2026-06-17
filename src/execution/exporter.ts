import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { attest, verifyAttestation } from "../ledger/attest";
import type { BlockReasonRow, RunEvent, TradingLogRow } from "./events";

export interface PaperSessionSummary {
  runId: string;
  mode: "paper";
  assets: number;
  started: string;
  ended: string;
  totalIntents: number;
  allowed: number;
  capped: number;
  rejected: number;
  simulatedFills: number;
  blockedUnsafeIntents: number;
  startingBalance: number;
  endingBalance: number;
  ledgerHash: string;
  signatureValid: boolean;
  outputDir: string;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv<T extends Record<string, unknown>>(file: string, rows: T[], headers: (keyof T)[]): void {
  const text = [
    headers.map(String).join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n");
  writeFileSync(file, text + "\n");
}

export function hashRecords(records: unknown): string {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

export function exportTradingEvidence(args: {
  outputDir: string;
  events: RunEvent[];
  tradingRows: TradingLogRow[];
  blockRows: BlockReasonRow[];
  accountSnapshots: unknown[];
  summary: Omit<PaperSessionSummary, "ledgerHash" | "signatureValid" | "outputDir">;
}): PaperSessionSummary {
  mkdirSync(args.outputDir, { recursive: true });
  const ledgerHash = hashRecords({ events: args.events, tradingRows: args.tradingRows, blockRows: args.blockRows });
  const attestation = attest([{ ledgerHash, runId: args.summary.runId, rows: args.tradingRows.length }]);
  const signatureValid = verifyAttestation([{ ledgerHash, runId: args.summary.runId, rows: args.tradingRows.length }], attestation);
  const summary: PaperSessionSummary = { ...args.summary, ledgerHash, signatureValid, outputDir: args.outputDir };

  writeCsv(join(args.outputDir, "nightdesk-paper-trading-log.csv"), args.tradingRows as unknown as Record<string, unknown>[], [
    "timestamp",
    "run_id",
    "asset",
    "venue_symbol",
    "direction",
    "price",
    "quantity",
    "notional_usdt",
    "balance_before",
    "balance_after",
    "balance_change",
    "certificate_id",
    "firewall_verdict",
    "policy",
    "reason",
    "ledger_hash",
    "fill_model",
    "liquidity_score",
    "slippage_bps",
    "order_denied_reason",
  ] as (keyof TradingLogRow)[]);
  writeFileSync(join(args.outputDir, "nightdesk-paper-trading-log.jsonl"), args.tradingRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(args.outputDir, "account-snapshots.jsonl"), args.accountSnapshots.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeCsv(join(args.outputDir, "block-reasons.csv"), args.blockRows as unknown as Record<string, unknown>[], [
    "timestamp",
    "run_id",
    "asset",
    "venue_symbol",
    "requested_direction",
    "certificate_id",
    "firewall_verdict",
    "policy",
    "reason",
    "ledger_hash",
  ] as (keyof BlockReasonRow)[]);
  writeFileSync(join(args.outputDir, "run-events.jsonl"), args.events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  writeFileSync(join(args.outputDir, "ledger-attestation.json"), JSON.stringify({ ledgerHash, attestation }, null, 2) + "\n");
  writeFileSync(
    join(args.outputDir, "ledger-verification.txt"),
    [
      "NightDesk paper trading ledger verification",
      `run_id=${summary.runId}`,
      `ledger_hash=${ledgerHash}`,
      `signature_valid=${signatureValid}`,
      `records=${args.tradingRows.length}`,
    ].join("\n") + "\n"
  );
  writeFileSync(
    join(args.outputDir, "grade-at-open-report.md"),
    [
      "# Grade At Open Report",
      "",
      "This paper session is an execution-path evidence run: it proves that agent intents pass through certificates, firewall decisions, PaperPit/BitSim fills, balance changes, event logs, and a signed ledger hash.",
      "",
      "For open-resolution convergence grading, run an off-hours to NYSE-open recording through:",
      "",
      "```bash",
      "npm run simulate data/snapshots/<open-spanning-recording>.jsonl -- --grade-at-open",
      "```",
      "",
      "NightDesk treats TRADE, ABSTAIN, and BLOCK as first-class agent actions; blocked rows are not hidden from the record.",
    ].join("\n") + "\n"
  );
  writeFileSync(
    join(args.outputDir, "run-summary.md"),
    [
      "# NightDesk Paper Trading Run Summary",
      "",
      `Run ID: ${summary.runId}`,
      "Mode: paper",
      `Assets: ${summary.assets} Bitget tokenized US stock basis pairs`,
      `Started: ${summary.started}`,
      `Ended: ${summary.ended}`,
      "Market regime: recorded tokenized-stock snapshot replay",
      `Total intents: ${summary.totalIntents}`,
      `Allowed: ${summary.allowed}`,
      `Capped: ${summary.capped}`,
      `Rejected: ${summary.rejected}`,
      `Trades simulated: ${summary.simulatedFills}`,
      `Blocked unsafe intents: ${summary.blockedUnsafeIntents}`,
      `Starting balance: ${summary.startingBalance.toFixed(2)} USDT`,
      `Ending balance: ${summary.endingBalance.toFixed(2)} USDT`,
      `Ledger hash: ${summary.ledgerHash}`,
      `Ledger verification: ${summary.signatureValid ? "pass" : "fail"}`,
      "",
      "Generated files:",
      "",
      "- `nightdesk-paper-trading-log.csv`",
      "- `nightdesk-paper-trading-log.jsonl`",
      "- `account-snapshots.jsonl`",
      "- `block-reasons.csv`",
      "- `run-events.jsonl`",
      "- `ledger-verification.txt`",
      "",
      "Nautilus-inspired execution integrity:",
      "",
      "- immutable event topics",
      "- standardized risk denial codes",
      "- deterministic order IDs",
      "- fill model, liquidity score, and slippage bps recorded on trading rows",
    ].join("\n") + "\n"
  );
  return summary;
}
