export interface ObjectiveInput {
  netPnl: number;
  maxDrawdown: number;
  fees: number;
  trades: number;
  blocks: number;
  blockedLossAvoided: number;
  falseBlockCost: number;
  implementationShortfall?: number; // expected-vs-realized execution cost (execution-cost attribution)
}

export function championshipPnlScore(x: ObjectiveInput): number {
  return x.netPnl - 0.25 * x.maxDrawdown - 0.1 * x.fees;
}

export function safetyScore(x: ObjectiveInput): number {
  return x.netPnl - 2 * x.maxDrawdown - 0.5 * x.fees + x.blockedLossAvoided - x.falseBlockCost;
}

/** Capital champion: return per unit drawdown (Calmar-like) — capital efficiency, not raw PnL. */
export function capitalScore(x: ObjectiveInput): number {
  return x.netPnl / Math.max(1, x.maxDrawdown);
}

/** Liquidity champion: realistic capacity + low implementation shortfall — PnL net of execution cost,
 *  penalising churn (a strategy that only works at tiny size / high turnover scores poorly). */
export function liquidityScore(x: ObjectiveInput): number {
  return x.netPnl - (x.implementationShortfall ?? 0) - 0.1 * x.fees - 0.02 * x.trades;
}

export type LaneName = "pnl" | "safety" | "capital" | "liquidity";

export interface LaneCandidate {
  id: string;
  objective: ObjectiveInput;
  hardGatesPassed: boolean; // non-negotiable invariants; an unsafe candidate is never a champion
}

/** Select the four champion lanes from one candidate set. A locked lane is frozen — the lock wins over
 *  any re-fit, so the champion cannot change during a forward window. Unsafe candidates are excluded. */
export function selectChampionLanes(candidates: LaneCandidate[], locked: Partial<Record<LaneName, string>> = {}): Record<LaneName, string | null> {
  const eligible = candidates.filter((c) => c.hardGatesPassed);
  const pick = (score: (x: ObjectiveInput) => number, lane: LaneName): string | null => {
    if (locked[lane]) return locked[lane]!;
    if (!eligible.length) return null;
    return [...eligible].sort((a, b) => score(b.objective) - score(a.objective))[0]!.id;
  };
  return { pnl: pick(championshipPnlScore, "pnl"), safety: pick(safetyScore, "safety"), capital: pick(capitalScore, "capital"), liquidity: pick(liquidityScore, "liquidity") };
}

export type ForwardStatus = "ACTIVE" | "WATCH" | "RETIRE";

/** Forward governance: a frozen champion whose forward record degrades is benched/retired going forward.
 *  This changes the champion's STATUS — it never rewrites the signed history. */
export function classifyForwardStatus(forwardNetPnl: number, forwardMaxDrawdown: number, expectedNetPnl: number): ForwardStatus {
  if (forwardNetPnl < -5 || forwardMaxDrawdown > Math.max(10, Math.abs(expectedNetPnl))) return "RETIRE";
  if (forwardNetPnl < 0.5 * expectedNetPnl) return "WATCH";
  return "ACTIVE";
}

export function robustnessLabel(scorePnl: number, scoreSafety: number, minLeaveOneOutPnl: number, costStressPnl: number): "pass" | "watch" | "fragile" {
  if (minLeaveOneOutPnl < -5 || costStressPnl < -5) return "fragile";
  if (scorePnl > 0 && scoreSafety > -10) return "pass";
  return "watch";
}
