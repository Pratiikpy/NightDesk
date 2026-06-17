export interface SecurityBoundaryConfig {
  enableLiveTrade: boolean;
  enableShellTools: boolean;
  apiAuthKeyPresent: boolean;
  clientHost: string;
  orderType: "limit" | "market";
  notionalUsd: number;
  leverage: number;
}

export interface SecurityBoundaryDecision {
  allowed: boolean;
  reason: string;
  mode: "read_only" | "paper" | "live";
}

export function envSecurityConfig(overrides: Partial<SecurityBoundaryConfig> = {}): SecurityBoundaryConfig {
  return {
    enableLiveTrade: process.env.NIGHTDESK_ENABLE_LIVE_TRADE === "1",
    enableShellTools: process.env.NIGHTDESK_ENABLE_SHELL_TOOLS === "1",
    apiAuthKeyPresent: Boolean(process.env.API_AUTH_KEY),
    clientHost: "localhost",
    orderType: "limit",
    notionalUsd: 0,
    leverage: 1,
    ...overrides,
  };
}

export function isTrustedLocalHost(host: string): boolean {
  const normalized = host.toLowerCase().split(":")[0] ?? "";
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function evaluateLiveTradeBoundary(cfg: SecurityBoundaryConfig): SecurityBoundaryDecision {
  if (!cfg.enableLiveTrade) return { allowed: false, reason: "LIVE_TRADE_DISABLED", mode: "paper" };
  if (!isTrustedLocalHost(cfg.clientHost) && !cfg.apiAuthKeyPresent) return { allowed: false, reason: "REMOTE_API_REQUIRES_AUTH", mode: "read_only" };
  if (cfg.orderType !== "limit") return { allowed: false, reason: "LIVE_REQUIRES_LIMIT_ORDER", mode: "live" };
  if (cfg.leverage > 1) return { allowed: false, reason: "LEVERAGE_DISABLED_BY_DEFAULT", mode: "live" };
  if (cfg.notionalUsd <= 0 || cfg.notionalUsd > 10) return { allowed: false, reason: "DUST_NOTIONAL_CAP_10_USDT", mode: "live" };
  return { allowed: true, reason: "LIVE_DUST_LIMIT_ORDER_ALLOWED", mode: "live" };
}

export function evaluateShellToolBoundary(cfg: SecurityBoundaryConfig): SecurityBoundaryDecision {
  if (!cfg.enableShellTools) return { allowed: false, reason: "SHELL_TOOLS_DISABLED", mode: "read_only" };
  if (!isTrustedLocalHost(cfg.clientHost) && !cfg.apiAuthKeyPresent) return { allowed: false, reason: "REMOTE_API_REQUIRES_AUTH", mode: "read_only" };
  return { allowed: true, reason: "SHELL_TOOLS_EXPLICITLY_ENABLED", mode: "paper" };
}
