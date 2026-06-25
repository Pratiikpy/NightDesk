// Restricted live pilot controller (Month 8). Governs the staged progression shadow -> dust ->
// restricted micro-capital, fail-closed at every step: a live order is authorized ONLY when the env
// gate, the capability, the per-stage size cap, and (for dust) manual confirmation all hold. A
// kill-switch or any reported breach returns the system to SHADOW mode immediately. Deploying real
// capital is the operational gate this software enforces; the controller itself is fully testable.

export type PilotStage = "SHADOW" | "DUST" | "MICRO";

export interface PilotConfig {
  liveEnabled: boolean; // env gate (NIGHTDESK_ENABLE_LIVE_TRADE)
  capability: boolean; // gateway live capability granted
  dustCapUsd: number; // hard per-order cap in DUST
  microCapUsd: number; // hard per-order cap in restricted MICRO
  simVsLiveBandPct: number; // declared acceptable simulation-vs-live error band
}

export interface LiveOrderRequest {
  sizeUsd: number;
  manualConfirmed: boolean; // dust orders are manual-confirmed
}

export interface LiveAuthDecision {
  authorized: boolean;
  reason: string;
  stage: PilotStage;
  killed: boolean;
}

export class LivePilot {
  stage: PilotStage = "SHADOW";
  killed = false;
  readonly breaches: string[] = [];

  constructor(private readonly cfg: PilotConfig) {}

  /** Advance one stage — only from a healthy (un-killed, un-breached) state and never past MICRO. */
  promote(): PilotStage {
    if (this.killed || this.breaches.length) return this.stage;
    if (this.stage === "SHADOW") this.stage = "DUST";
    else if (this.stage === "DUST") this.stage = "MICRO";
    return this.stage;
  }

  /** Kill-switch: stop all live activity and return to shadow mode. */
  kill(reason: string): void {
    this.killed = true;
    this.stage = "SHADOW";
    this.breaches.push(`kill:${reason}`);
  }

  /** Any safety/reconciliation breach reverts the system to shadow mode (fail-closed). */
  reportBreach(reason: string): void {
    this.breaches.push(reason);
    this.stage = "SHADOW";
  }

  /** Fail-closed authorization: every gate must hold, or the order is rejected (no real fill). */
  authorize(req: LiveOrderRequest): LiveAuthDecision {
    const base = { stage: this.stage, killed: this.killed };
    if (this.killed) return { authorized: false, reason: "kill-switch engaged — shadow mode only", ...base };
    if (this.stage === "SHADOW") return { authorized: false, reason: "shadow mode — no live orders", ...base };
    if (!this.cfg.liveEnabled) return { authorized: false, reason: "live trading disabled (env gate)", ...base };
    if (!this.cfg.capability) return { authorized: false, reason: "missing live capability", ...base };
    const cap = this.stage === "DUST" ? this.cfg.dustCapUsd : this.cfg.microCapUsd;
    if (!(req.sizeUsd > 0 && req.sizeUsd <= cap)) return { authorized: false, reason: `size $${req.sizeUsd} exceeds ${this.stage} cap $${cap}`, ...base };
    if (this.stage === "DUST" && !req.manualConfirmed) return { authorized: false, reason: "dust order requires manual confirmation", ...base };
    return { authorized: true, reason: "ok", ...base };
  }
}

export interface LiveReceipt {
  cycleId: string;
  certificateId: string;
  gatePassed: boolean;
  orderId: string;
  fillStatus: string;
  ledgerHash: string;
}

/** A live receipt is valid only if it links the COMPLETE decision chain. */
export function decisionChainComplete(r: LiveReceipt): boolean {
  return !!r.cycleId && !!r.certificateId && r.gatePassed === true && !!r.orderId && !!r.fillStatus && !!r.ledgerHash;
}

/** Simulation-vs-live execution error must stay inside the declared band. */
export function simVsLiveWithinBand(simPnl: number, livePnl: number, bandPct: number): boolean {
  const denom = Math.max(1e-9, Math.abs(simPnl));
  return (Math.abs(simPnl - livePnl) / denom) * 100 <= bandPct;
}
