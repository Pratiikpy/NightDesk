import { createHash, timingSafeEqual } from "node:crypto";
import type { GatewayCapability } from "./contracts";

export interface AgentPrincipal {
  agentId: string;
  capabilities: ReadonlySet<GatewayCapability>;
  disabled: boolean;
}

interface StoredPrincipal extends AgentPrincipal {
  tokenHash: Buffer;
}

export class GatewayAuthenticationError extends Error {
  constructor(message = "gateway authentication failed") {
    super(message);
    this.name = "GatewayAuthenticationError";
  }
}

export class GatewayAuthorizationError extends Error {
  constructor(agentId: string, capability: GatewayCapability) {
    super(`agent ${agentId} lacks capability ${capability}`);
    this.name = "GatewayAuthorizationError";
  }
}

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export class AgentCredentialStore {
  private readonly principals = new Map<string, StoredPrincipal>();

  register(input: {
    agentId: string;
    token: string;
    capabilities: Iterable<GatewayCapability>;
    disabled?: boolean;
  }): void {
    const agentId = input.agentId.trim();
    if (!agentId || !input.token) throw new Error("agentId and token are required");
    this.principals.set(agentId, {
      agentId,
      tokenHash: hashToken(input.token),
      capabilities: new Set(input.capabilities),
      disabled: input.disabled ?? false,
    });
  }

  revoke(agentId: string): void {
    const current = this.principals.get(agentId);
    if (current) this.principals.set(agentId, { ...current, disabled: true });
  }

  authenticate(agentId: string, token: string): AgentPrincipal {
    const stored = this.principals.get(agentId);
    const supplied = hashToken(token);
    const expected = stored?.tokenHash ?? Buffer.alloc(supplied.length);
    const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
    if (!stored || !matches || stored.disabled) throw new GatewayAuthenticationError();
    return { agentId: stored.agentId, capabilities: stored.capabilities, disabled: false };
  }

  authorize(principal: AgentPrincipal, capability: GatewayCapability): void {
    if (principal.disabled || !principal.capabilities.has(capability)) {
      throw new GatewayAuthorizationError(principal.agentId, capability);
    }
  }
}
