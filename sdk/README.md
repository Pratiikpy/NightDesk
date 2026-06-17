# NightDesk Client SDK

A tiny, zero-dependency client so **any** AI trading agent can route its trade intents through the
NightDesk Agent Firewall before executing on Bitget tokenized stocks. If NightDesk doesn't certify
the market as safe, the intent is rejected — or capped to a safe size.

## Use

```ts
import { NightDeskClient } from "./nightdesk-client";

const nd = new NightDeskClient("http://localhost:8787"); // run `npm run dashboard`

const intent = { ticker: "NVDA", side: "buy", sizeUsd: 50 } as const;
const verdict = await nd.evaluateIntent(intent);

if (verdict.verdict === "REJECT") {
  // do not trade — verdict.reason explains why (news / stale anchor / liquidity trap / …)
} else {
  const size = nd.allowedSize(intent, verdict); // capped to the certificate's max size
  // place the Bitget order with `size`
}
```

## Verdicts
- `ALLOW` — trade permitted at the requested size.
- `ALLOW_CAPPED` — permitted, but only up to `cappedSizeUsd` (the certificate's max for this market).
- `REJECT` — not permitted; `reason` says why (no/expired/tampered certificate, ticker mismatch,
  news-driven / macro / issuer / liquidity-trap / stale market, or a non-tradeable policy).

The contract is defined in [`../AGENT_INTENT_SPEC.md`](../AGENT_INTENT_SPEC.md); the same firewall is
also exposed as the MCP tool `evaluate_intent` (`npm run mcp`). Runnable example: `examples/external-agent.ts`.
