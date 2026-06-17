# Agent Intent Spec v1.0 — the NightDesk trade-intent safety contract

Any AI agent that wants to trade a Bitget tokenized US stock expresses its intent in this minimal,
exchange-agnostic schema and submits it to NightDesk **before** execution. NightDesk returns a
deterministic verdict backed by a signed certificate. No valid certificate → no trade.

## 1. TradeIntent

```ts
interface TradeIntent {
  ticker: string;            // e.g. "NVDA" (the underlying; NightDesk maps to the rToken/perp leg)
  side: "buy" | "sell";
  sizeUsd: number;           // requested notional in USD
  certificate?: NightDeskCertificate; // attach one, or let the firewall issue a fresh one
}
```

A richer, self-describing form an LLM agent can emit (fields beyond the four above are advisory and
logged, not trusted):

```json
{
  "ticker": "rNVDA",
  "market_type": "spot",
  "side": "buy",
  "size_usd": 100,
  "leverage": 1,
  "time_horizon": "overnight",
  "rationale_text": "rToken looks cheap vs the real stock",
  "confidence": 0.7
}
```

## 2. The verdict

```ts
type Verdict = "ALLOW" | "ALLOW_CAPPED" | "REJECT";
interface FirewallDecision {
  verdict: Verdict;
  reason: string;
  cappedSizeUsd?: number; // present on ALLOW_CAPPED
}
```

A trade is **REJECTED** if any of these hold (deterministic, in order):
1. no certificate, or an invalid/tampered signature
2. the certificate has expired (default TTL 120s — off-hours quotes go stale fast)
3. the certificate's ticker ≠ the intent's ticker
4. the certificate's `allowedPolicy` is non-tradeable (`BLOCK` / `AVOID` / `ABSTAIN` / `WATCH`)
5. the policy is `LONG-ONLY FADE` and the intent is a `sell` (rTokens aren't cleanly shortable)
6. the certificate's `maxSizeUsd` is 0

Otherwise it is **ALLOW** (within `maxSizeUsd`) or **ALLOW_CAPPED** (size reduced to `maxSizeUsd`).

## 3. The certificate (what the verdict is backed by)

```ts
interface NightDeskCertificate {
  payload: {
    version: "1.0";
    ticker: string;
    issuedAt: string; expiresAt: string;   // a cert cannot outlive its market snapshot
    anchorSource: "NYSE_LIVE" | "LAST_CLOSE" | "NONE";
    anchorStale: boolean;
    classification: "FAIR" | "MISPRICED" | "NEWS-DRIVEN" | "MACRO-RISK" | "ISSUER-RISK" | "LIQUIDITY-TRAP" | "UNTRADEABLE" | "STALE";
    safetyScore: number;                    // 0–100, data-quality + tradeability, NOT alpha
    allowedPolicy: "NORMAL" | "LONG-ONLY FADE" | "WATCH" | "ABSTAIN" | "AVOID" | "BLOCK";
    maxSizeUsd: number;
    evidence: string[];
  };
  attestation: { algo: "ed25519"; recordsSha256: string; signatureHex: string; publicKeyPem: string; signedAt: string };
}
```

The signature is verifiable offline against the embedded public key; altering any payload field
invalidates it. Market-integrity invariants (stale anchor never tradeable, liquidity-trap must block,
news/macro can't fade, score in range) are enforced by the issuer and proven by a fuzz test.

## 4. How an agent calls NightDesk

- **MCP** (any Claude / Cursor / Codex / Bitget Agent Hub agent): call the `evaluate_intent` tool on
  the NightDesk MCP server (`npm run mcp`) with `{ ticker, side, sizeUsd }`. It returns the verdict +
  the certificate fields. `certify_token` and `score_universe` are also exposed.
- **In-process (TS):** `import { evaluateIntent } from "nightdesk/kernel/firewall"` and pass a
  `TradeIntent` carrying a certificate from `issueCertificate(...)`.

The contract is intentionally tiny: an agent describes *what it wants*; NightDesk decides *whether it
is allowed* and signs the decision.
