// Precompute the Agent Firewall's certificate universe from the latest live snapshot, so the deployed
// serverless endpoint can issue verdicts WITHOUT a live data fetch (fast, reproducible, no cold-start
// timeouts). Run locally: `npm run firewall:export`.
//
// Output is the unsigned per-token certificate INPUTS (certifyToken output) — the endpoint signs a fresh
// certificate per request with an ephemeral key, so the secret attestation key is never deployed.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { collect } from "../pegwatch/collect";
import { MarketEventProvider } from "../perception/events";
import { certifyToken } from "../research/certify";

export async function exportFirewallUniverse(): Promise<void> {
  const eventProvider = new MarketEventProvider();
  const snap = await collect();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => eventProvider.contextFor(r.ticker, snap.ts))));
  const universe = snap.rows.map((r, i) => {
    const anchorSource: "NYSE_LIVE" | "LAST_CLOSE" | "NONE" =
      r.equity == null ? "NONE" : r.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE";
    return { ticker: r.ticker, cert: certifyToken(r, ctxs[i]!), anchorStale: r.equity == null, anchorSource };
  });
  const OUT = join(process.cwd(), "api");
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, "firewall-universe.json");
  writeFileSync(
    file,
    JSON.stringify({ generatedAt: new Date().toISOString(), snapshotAt: new Date(snap.ts).toISOString(), tickers: universe.length, universe }, null, 2) + "\n",
  );
  console.log(`NIGHTDESK FIREWALL UNIVERSE EXPORTED: ${universe.length} tickers -> ${file}`);
  for (const e of universe) console.log(`  ${e.ticker.padEnd(6)} ${e.cert.policy.padEnd(16)} safety=${e.cert.safetyScore} class=${e.cert.classification}`);
}

if (process.argv[1]?.endsWith("export-firewall.ts")) exportFirewallUniverse();
