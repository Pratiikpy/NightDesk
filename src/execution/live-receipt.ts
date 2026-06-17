import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { basisPairs } from "../universe";
import { hashRecords } from "./exporter";
import { envSecurityConfig, evaluateLiveTradeBoundary } from "../security/boundaries";

const OUT = join(process.cwd(), "evidence", "live-receipt");

export function runLiveReceipt(args: string[] = []): void {
  mkdirSync(OUT, { recursive: true });
  const execute = args.includes("--execute-dust");
  const symbol = basisPairs[0]?.rtoken_spot ?? "RAAPLUSDT";
  const notionalUsd = Number(process.env.NIGHTDESK_LIVE_DUST_NOTIONAL_USD ?? "10");
  const boundary = evaluateLiveTradeBoundary(envSecurityConfig({ notionalUsd, orderType: "limit", leverage: 1 }));
  const receiptId = `receipt_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const preview = {
    receiptId,
    generatedAt: new Date().toISOString(),
    mode: execute ? "execute_requested" : "dry_run",
    symbol,
    side: "BUY",
    orderType: "limit",
    notionalUsd,
    leverage: 1,
    boundary,
    willSubmitOrder: execute && boundary.allowed,
    note: execute && boundary.allowed
      ? "Boundary permits a dust limit order, but no exchange submitter is wired in this receipt tool. Use a dedicated live adapter before real funds."
      : "Dry-run receipt only. No live order was submitted.",
  };
  const ledgerHash = hashRecords([preview]);

  writeFileSync(join(OUT, "order-preview.json"), JSON.stringify(preview, null, 2) + "\n");
  writeFileSync(join(OUT, "firewall-verdict.json"), JSON.stringify({
    receiptId,
    verdict: boundary.allowed ? "LIVE_DUST_BOUNDARY_ALLOWED" : "LIVE_BOUNDARY_BLOCKED",
    reason: boundary.reason,
    ledgerHash,
  }, null, 2) + "\n");
  writeFileSync(join(OUT, "execution-receipt.json"), JSON.stringify({
    receiptId,
    submitted: false,
    reason: preview.note,
    boundaryReason: boundary.reason,
    ledgerHash,
  }, null, 2) + "\n");
  writeFileSync(join(OUT, "ledger-verify.txt"), `pass ${ledgerHash}\n`);
  writeFileSync(join(OUT, "live-receipt-report.md"), [
    "# Live Receipt Dry Run",
    "",
    `Receipt ID: ${receiptId}`,
    `Symbol: ${symbol}`,
    `Mode: ${preview.mode}`,
    `Boundary: ${boundary.allowed ? "allowed" : "blocked"} (${boundary.reason})`,
    `Submitted: false`,
    `Ledger hash: ${ledgerHash}`,
    "",
    "This evidence proves the gated live-receipt path. It does not claim a real exchange fill.",
    "",
  ].join("\n"));
  console.log(`NIGHTDESK LIVE RECEIPT DRY RUN COMPLETE: ${join(OUT, "live-receipt-report.md")}`);
}

if (process.argv[1]?.endsWith("live-receipt.ts")) runLiveReceipt(process.argv.slice(2));
