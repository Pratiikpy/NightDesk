import type { FirewallDecision, Verdict } from "../kernel/firewall";

export type ExecutionMode = "paper" | "live";
export type ComponentState =
  | "PRE_INITIALIZED"
  | "READY"
  | "STARTING"
  | "RUNNING"
  | "DEGRADED"
  | "STOPPING"
  | "STOPPED"
  | "FAULTED"
  | "DISPOSED";

export type RunTopic =
  | "data.snapshot"
  | "cert.issued"
  | "intent.submitted"
  | "firewall.verdict"
  | "risk.denied"
  | "order.submitted"
  | "order.filled"
  | "account.snapshot"
  | "ledger.signed"
  | "component.state";

export type OrderDeniedReason =
  | "PRICE_PRECISION_INVALID"
  | "QUANTITY_PRECISION_INVALID"
  | "NOTIONAL_EXCEEDS_FREE_BALANCE"
  | "NOTIONAL_EXCEEDS_RISK_LIMIT"
  | "TRADING_HALTED"
  | "LIQUIDITY_TOO_THIN"
  | "STALE_ANCHOR"
  | "FIREWALL_REJECTED"
  | "RATE_LIMIT_EXCEEDED"
  | "DUPLICATE_ORDER"
  | "WOULD_INCREASE_REDUCE_ONLY_POSITION"
  | "NAKED_SPOT_SELL"
  | "NO_EXECUTABLE_QUOTE";

export type TradingState = "ACTIVE" | "HALTED" | "REDUCING";
export type FillModelName =
  | "best_price"
  | "one_tick_slippage"
  | "size_aware"
  | "market_hours"
  | "volume_sensitive"
  | "competition_aware"
  | "partial_limit_fill";

export interface BaseRunEvent {
  type: string;
  timestamp: string;
  runId: string;
  topic?: RunTopic;
}

export interface MarketSnapshotEvent extends BaseRunEvent {
  type: "MARKET_SNAPSHOT";
  topic?: "data.snapshot";
  tokens: number;
  source: string;
}

export interface CertificateIssuedEvent extends BaseRunEvent {
  type: "CERTIFICATE_ISSUED";
  topic?: "cert.issued";
  asset: string;
  certificateId: string;
  policy: string;
  classification: string;
  safetyScore: number;
}

export interface IntentSubmittedEvent extends BaseRunEvent {
  type: "INTENT_SUBMITTED";
  topic?: "intent.submitted";
  asset: string;
  venueSymbol: string;
  side: "buy" | "sell";
  requestedNotionalUsdt: number;
}

export interface FirewallVerdictEvent extends BaseRunEvent {
  type: "FIREWALL_VERDICT";
  topic?: "firewall.verdict";
  asset: string;
  verdict: Verdict;
  reason: string;
  allowedNotionalUsdt: number;
  policy: string;
}

export interface OrderSimulatedEvent extends BaseRunEvent {
  type: "ORDER_SIMULATED";
  topic?: "order.submitted";
  asset: string;
  venueSymbol: string;
  side: "buy" | "sell";
  notionalUsdt: number;
}

export interface FillSimulatedEvent extends BaseRunEvent {
  type: "FILL_SIMULATED";
  topic?: "order.filled";
  asset: string;
  venueSymbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  feePaid: number;
  balanceBefore: number;
  balanceAfter: number;
  fillModel?: FillModelName;
  slippageBps?: number;
}

export interface AccountSnapshotEvent extends BaseRunEvent {
  type: "ACCOUNT_SNAPSHOT";
  topic?: "account.snapshot";
  balance: number;
  cash: number;
  feesPaid: number;
  trades: number;
}

export interface LedgerSignedEvent extends BaseRunEvent {
  type: "LEDGER_SIGNED";
  topic?: "ledger.signed";
  ledgerHash: string;
  signatureValid: boolean;
  records: number;
}

export interface RiskDeniedEvent extends BaseRunEvent {
  type: "RISK_DENIED";
  topic?: "risk.denied";
  asset: string;
  venueSymbol: string;
  reasonCode: OrderDeniedReason;
  reason: string;
}

export interface ComponentStateEvent extends BaseRunEvent {
  type: "COMPONENT_STATE";
  topic?: "component.state";
  component: string;
  from: ComponentState;
  to: ComponentState;
}

export type RunEvent =
  | MarketSnapshotEvent
  | CertificateIssuedEvent
  | IntentSubmittedEvent
  | FirewallVerdictEvent
  | OrderSimulatedEvent
  | FillSimulatedEvent
  | AccountSnapshotEvent
  | LedgerSignedEvent
  | RiskDeniedEvent
  | ComponentStateEvent;

export interface TradingLogRow {
  timestamp: string;
  run_id: string;
  asset: string;
  venue_symbol: string;
  direction: "BUY" | "SELL" | "BLOCK";
  price: number;
  quantity: number;
  notional_usdt: number;
  balance_before: number;
  balance_after: number;
  balance_change: number;
  certificate_id: string;
  firewall_verdict: FirewallDecision["verdict"];
  policy: string;
  reason: string;
  ledger_hash: string;
  fill_model?: FillModelName | "";
  liquidity_score?: number;
  slippage_bps?: number;
  order_denied_reason?: OrderDeniedReason | "";
}

export interface BlockReasonRow {
  timestamp: string;
  run_id: string;
  asset: string;
  venue_symbol: string;
  requested_direction: "BUY" | "SELL";
  certificate_id: string;
  firewall_verdict: Verdict;
  policy: string;
  reason: string;
  ledger_hash: string;
}
