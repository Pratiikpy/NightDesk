import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { basisPairs } from "../../universe";
import { spotBook, spotTicker } from "../../bitget/client";

const OUT = join(process.cwd(), "evidence", "bitget-live");

export async function runBitgetReadOnlyProof(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const symbol = basisPairs[0]?.rtoken_spot ?? "RAAPLUSDT";
  const startedAt = new Date().toISOString();
  const lines: unknown[] = [];
  let snapshot: unknown;
  let ok = false;
  try {
    const [ticker, book] = await Promise.all([spotTicker(symbol), spotBook(symbol, 5)]);
    snapshot = { mode: "public-read-only", symbol, ticker, book, fetchedAt: new Date().toISOString(), requiresCredentials: false };
    lines.push({ timestamp: new Date().toISOString(), endpoint: "spotTicker", symbol, ok: true, ts: ticker.ts });
    lines.push({ timestamp: new Date().toISOString(), endpoint: "spotBook", symbol, ok: true, levels: book.levels });
    ok = true;
  } catch (e) {
    snapshot = { mode: "public-read-only", symbol, fetchedAt: new Date().toISOString(), ok: false, error: (e as Error).message };
    lines.push({ timestamp: new Date().toISOString(), endpoint: "public-read-only", symbol, ok: false, error: (e as Error).message });
  }
  writeFileSync(join(OUT, "live-market-snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
  writeFileSync(join(OUT, "bitget-smoke-log.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  writeFileSync(join(OUT, "read-only-proof.md"), [
    "# Bitget Live Read-Only Proof",
    "",
    `Started: ${startedAt}`,
    `Symbol: ${symbol}`,
    `Result: ${ok ? "public market data fetched without credentials" : "public fetch unavailable in this environment; see smoke log"}`,
    "",
    "Safety posture: env-only credentials for private endpoints, read-only default, no write operation in this proof, no secrets logged.",
  ].join("\n") + "\n");
  writeFileSync(join(OUT, "certificate-from-live-data.json"), JSON.stringify({ note: ok ? "Live ticker/orderbook snapshot captured; certificate path remains the same as paper-session and MCP certify_token." : "Live public endpoint unavailable during this run; use npm run bitget:read-only-proof to retry.", snapshot }, null, 2) + "\n");
  console.log("\nNIGHTDESK BITGET READ-ONLY PROOF COMPLETE");
  console.log(`status: ${ok ? "live public fetch ok" : "fallback evidence written"}`);
  console.log(`snapshot: ${join(OUT, "live-market-snapshot.json")}`);
}

if (process.argv[1]?.endsWith("readOnlyProof.ts")) {
  runBitgetReadOnlyProof().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
