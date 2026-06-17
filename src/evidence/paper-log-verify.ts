import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function lines(file: string): string[] {
  return readFileSync(join(process.cwd(), file), "utf8").split(/\r?\n/).filter(Boolean);
}

function parseCsv(file: string): Record<string, string>[] {
  const rows = lines(file);
  if (!rows.length) return [];
  const headers = rows[0]!.split(",");
  return rows.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function finite(v: string | undefined): boolean {
  return Number.isFinite(Number(v));
}

export function runPaperLogVerify(): void {
  const file = "evidence/trading-log/nightdesk-paper-trading-log.csv";
  const rows = parseCsv(file);
  const required = [
    "timestamp",
    "asset",
    "direction",
    "price",
    "quantity",
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
  ];
  const headers = Object.keys(rows[0] ?? {});
  const failures: string[] = [];
  for (const h of required) if (!headers.includes(h)) failures.push(`missing column ${h}`);
  if (!rows.length) failures.push("paper log has zero rows");

  let tradeRows = 0;
  let blockRows = 0;
  let abstainRows = 0;
  rows.forEach((r, i) => {
    const row = i + 2;
    if (!Date.parse(r.timestamp ?? "")) failures.push(`row ${row}: invalid ISO timestamp`);
    if (!(r.asset ?? "")) failures.push(`row ${row}: missing asset`);
    if (!/^[a-f0-9]{64}$/.test(r.ledger_hash ?? "")) failures.push(`row ${row}: missing/bad ledger_hash`);
    if (!finite(r.balance_before) || !finite(r.balance_after) || !finite(r.balance_change)) failures.push(`row ${row}: invalid balance field`);
    else if (Math.abs(Number(r.balance_after) - Number(r.balance_before) - Number(r.balance_change)) > 1e-4) failures.push(`row ${row}: balance_after mismatch`);

    const dir = (r.direction ?? "").toUpperCase();
    const verdict = (r.firewall_verdict ?? "").toUpperCase();
    if (dir === "BLOCK" || verdict === "REJECT") {
      blockRows++;
      if (!(r.reason ?? "")) failures.push(`row ${row}: rejected/block row lacks reason`);
      if (!(r.order_denied_reason ?? "")) failures.push(`row ${row}: block row lacks denial reason`);
    } else if (dir === "ABSTAIN") {
      abstainRows++;
      if (!(r.reason ?? "")) failures.push(`row ${row}: abstain row lacks reason`);
    } else {
      tradeRows++;
      if (!finite(r.price) || Number(r.price) <= 0) failures.push(`row ${row}: trade row invalid price`);
      if (!finite(r.quantity) || Number(r.quantity) <= 0) failures.push(`row ${row}: trade row invalid quantity`);
      if (!(r.certificate_id ?? "")) failures.push(`row ${row}: allowed trade lacks certificate_id`);
      if (!(r.fill_model ?? "")) failures.push(`row ${row}: allowed trade lacks fill_model`);
      if (verdict !== "ALLOW" && verdict !== "ALLOW_CAPPED") failures.push(`row ${row}: trade row has bad verdict ${verdict}`);
    }
  });
  if (!tradeRows) failures.push("no TRADE rows");
  if (!blockRows) failures.push("no BLOCK/REJECT rows");

  const ok = failures.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    ok,
    file,
    rows: rows.length,
    tradeRows,
    blockRows,
    abstainRows,
    failures,
  };
  writeFileSync(join(process.cwd(), "evidence", "paper-log-verify.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`NIGHTDESK PAPER LOG VERIFY ${ok ? "PASS" : "FAIL"}`);
  console.log(`rows=${rows.length} trades=${tradeRows} blocks=${blockRows} abstains=${abstainRows}`);
  for (const f of failures) console.log(`✗ ${f}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("paper-log-verify.ts")) runPaperLogVerify();
