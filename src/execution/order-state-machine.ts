// Enforced order state machine — PURE, unit-tested, no I/O.
// An order's status is never set directly; it is the result of applying an ordered event log against a
// literal transition table. Anything not explicitly enumerated is an illegal transition and throws, so
// states like "fill a canceled order" or "double-fill past quantity" are provably impossible. Two
// distinct reject paths mirror NightDesk's design: `Denied` = rejected internally by our own risk gates
// (carries a typed reason); `Rejected` = rejected by the venue after submission.
//
// Original NightDesk TypeScript: an order's status is always the fold of an event log, never set directly.

export type OrderStatus =
  | "Initialized"
  | "Denied" // internal risk-gate rejection (pre-venue)
  | "Submitted"
  | "Rejected" // venue rejection (post-submit)
  | "Accepted"
  | "PartiallyFilled"
  | "CancelPending"
  | "Filled"
  | "Canceled"
  | "Expired";

export type OrderEventType = "Submit" | "Deny" | "Reject" | "Accept" | "Fill" | "CancelRequest" | "CancelAck" | "Cancel" | "Expire";

/** Typed denial reasons for the internal `Denied` path — mirror NightDesk's hard risk gates. */
export type DenialReason =
  | "STALE_ANCHOR"
  | "LIQUIDITY_TRAP"
  | "FEE_EDGE_NOT_MET"
  | "MAX_NOTIONAL_EXCEEDED"
  | "NEWS_DRIVEN_GAP"
  | "INVALID_PRICE"
  | "INVALID_QUANTITY"
  | "NO_CERTIFICATE"
  | "CERTIFICATE_EXPIRED"
  | "POLICY_VIOLATION";

export const TERMINAL_STATES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "Denied",
  "Rejected",
  "Filled",
  "Canceled",
  "Expired",
]);

// Literal transition table. `Fill` always targets PartiallyFilled; the reducer upgrades to Filled by
// quantity arithmetic (partial-vs-full is a quantity decision, never an FSM-table decision).
const TABLE: Record<OrderStatus, Partial<Record<OrderEventType, OrderStatus>>> = {
  Initialized: { Deny: "Denied", Submit: "Submitted" },
  Submitted: { Reject: "Rejected", Accept: "Accepted", Cancel: "Canceled", Expire: "Expired" },
  Accepted: { Fill: "PartiallyFilled", CancelRequest: "CancelPending", Cancel: "Canceled", Expire: "Expired" },
  PartiallyFilled: { Fill: "PartiallyFilled", CancelRequest: "CancelPending", Cancel: "Canceled", Expire: "Expired" },
  CancelPending: { Fill: "CancelPending", CancelAck: "Canceled", Expire: "Expired" },
  Denied: {},
  Rejected: {},
  Filled: {},
  Canceled: {},
  Expired: {},
};

/** Pure transition lookup: returns the next status, or null if the transition is illegal. */
export function transition(status: OrderStatus, event: OrderEventType): OrderStatus | null {
  return TABLE[status][event] ?? null;
}

export interface OrderEvent {
  type: OrderEventType;
  reason?: DenialReason; // required for Deny
  fillQty?: number; // required (>0) for Fill
  ts?: number;
}

const EPS = 1e-9;

export class OrderLifecycle {
  status: OrderStatus = "Initialized";
  filledQty = 0;
  denialReason: DenialReason | null = null;
  readonly events: OrderEvent[] = [];

  constructor(readonly quantity: number) {
    if (!(quantity > 0)) throw new Error("OrderLifecycle: quantity must be > 0");
  }

  apply(ev: OrderEvent): this {
    if (TERMINAL_STATES.has(this.status)) {
      throw new Error(`order is terminal (${this.status}); cannot apply ${ev.type}`);
    }
    if (ev.type === "Deny" && !ev.reason) throw new Error("Deny requires a typed reason");
    const next = transition(this.status, ev.type);
    if (next === null) throw new Error(`illegal transition: ${this.status} -(${ev.type})-> ?`);

    if (ev.type === "Fill") {
      const q = ev.fillQty ?? 0;
      if (!(q > 0)) throw new Error("Fill requires a positive fillQty");
      if (this.filledQty + q > this.quantity + EPS) {
        throw new Error(`overfill: ${this.filledQty + q} would exceed order quantity ${this.quantity}`);
      }
      this.filledQty += q;
      this.status = this.filledQty >= this.quantity - EPS ? "Filled" : next;
    } else {
      this.status = next;
      if (ev.type === "Deny") this.denialReason = ev.reason ?? null;
    }
    this.events.push(ev);
    return this;
  }

  get isOpen(): boolean {
    return !TERMINAL_STATES.has(this.status);
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this.status);
  }

  /** Event-sourced rebuild: replay an event log to reconstruct exact state (for signed evidence). */
  static fromEvents(quantity: number, events: OrderEvent[]): OrderLifecycle {
    const order = new OrderLifecycle(quantity);
    for (const ev of events) order.apply(ev);
    return order;
  }
}
