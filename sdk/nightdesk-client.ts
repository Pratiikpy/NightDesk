// NightDesk client SDK — a tiny, zero-dependency wrapper so any agent can route a trade intent
// through the NightDesk Agent Firewall over HTTP before executing on Bitget. Uses global fetch
// (Node 18+ / browser). See AGENT_INTENT_SPEC.md for the contract.

export interface IntentRequest {
  ticker: string;
  side: "buy" | "sell";
  sizeUsd: number;
}

export interface FirewallVerdict {
  verdict: "ALLOW" | "ALLOW_CAPPED" | "REJECT";
  reason: string;
  cappedSizeUsd?: number;
  classification?: string;
  allowedPolicy?: string;
  safetyScore?: number;
  maxSizeUsd?: number;
  certificateExpiresAt?: string;
}

export class NightDeskClient {
  constructor(private readonly baseUrl: string = "http://localhost:8787") {}

  /** Ask the firewall whether this trade intent may execute (and at what size). */
  async evaluateIntent(req: IntentRequest): Promise<FirewallVerdict> {
    const u = new URL("/api/firewall", this.baseUrl);
    u.searchParams.set("ticker", req.ticker);
    u.searchParams.set("side", req.side);
    u.searchParams.set("sizeUsd", String(req.sizeUsd));
    const res = await fetch(u);
    if (!res.ok) throw new Error(`NightDesk firewall HTTP ${res.status}`);
    return (await res.json()) as FirewallVerdict;
  }

  /** The allowed notional for this intent (0 if rejected). */
  allowedSize(req: IntentRequest, v: FirewallVerdict): number {
    if (v.verdict === "REJECT") return 0;
    if (v.verdict === "ALLOW_CAPPED") return v.cappedSizeUsd ?? 0;
    return req.sizeUsd;
  }
}
