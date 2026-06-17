// `npm run firewall` — a live demo of proof-carrying trade intents. Every agent intent must carry a
// valid, unexpired, matching NightDesk certificate; the firewall returns the verdict. This is the
// "no agent trades without passing through me" gate, shown end-to-end on the live universe.
import pLimit from "p-limit";
import { collect } from "../pegwatch/collect";
import { MarketEventProvider } from "../perception/events";
import { certifyToken } from "../research/certify";
import { issueCertificate } from "./certificate";
import { evaluateIntent } from "./firewall";

export async function printFirewallDemo(): Promise<void> {
  console.log("\nNightDesk Agent Firewall — proof-carrying trade intents (live)\n");
  const snap = await collect();
  const provider = new MarketEventProvider();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => provider.contextFor(r.ticker, snap.ts))));

  console.log("Every agent intent must carry a valid NightDesk certificate. Firewall verdict per token:\n");
  console.log("TICKER  side  classification   policy           verdict       reason");
  console.log("------  ----  ---------------  ---------------  ------------  ---");
  let allowed = 0;
  snap.rows.forEach((row, i) => {
    const stale = row.equity == null;
    const src = row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE";
    const tc = certifyToken(row, ctxs[i]!);
    const cert = issueCertificate(tc, { anchorSource: src, anchorStale: stale });
    const side: "buy" | "sell" = (tc.trueGapPct ?? 0) < 0 ? "buy" : "sell"; // natural fade direction
    const dec = evaluateIntent({ ticker: row.ticker, side, sizeUsd: 50, certificate: cert });
    if (dec.verdict !== "REJECT") allowed++;
    console.log(row.ticker.padEnd(6), side.padEnd(4), cert.payload.classification.padEnd(15), cert.payload.allowedPolicy.padEnd(15), dec.verdict.padEnd(12), dec.reason);
  });

  const naked = evaluateIntent({ ticker: snap.rows[0]?.ticker ?? "NVDA", side: "buy", sizeUsd: 50 });
  console.log(`\nintent with NO certificate → ${naked.verdict} (${naked.reason})`);
  console.log(`${allowed}/${snap.rows.length} tokens currently permit a (capped) trade. No agent touches a tokenized stock without a valid, unexpired, matching certificate.`);
}
