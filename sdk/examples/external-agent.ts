// Example: a third-party agent that routes EVERY trade through NightDesk before executing on Bitget.
// Run the dashboard first (`npm run dashboard`), then: npx tsx sdk/examples/external-agent.ts
import { NightDeskClient } from "../nightdesk-client";

async function main(): Promise<void> {
  const nd = new NightDeskClient(process.env.NIGHTDESK_URL ?? "http://localhost:8787");

  // The agent's own (naive) idea — it does NOT decide whether it's allowed; NightDesk does.
  const intent = { ticker: "NVDA", side: "buy" as const, sizeUsd: 50 };

  const verdict = await nd.evaluateIntent(intent);
  if (verdict.verdict === "REJECT") {
    console.log(`BLOCKED ${intent.side} ${intent.ticker}: ${verdict.reason}`);
    return;
  }
  const size = nd.allowedSize(intent, verdict);
  console.log(`ALLOWED ${intent.side} ${intent.ticker} up to $${size} (policy ${verdict.allowedPolicy}, safety ${verdict.safetyScore}, ${verdict.classification})`);
  // → the agent would now place the order on Bitget with `size` (and only `size`).
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
