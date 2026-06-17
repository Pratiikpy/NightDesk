export interface ObjectiveInput {
  netPnl: number;
  maxDrawdown: number;
  fees: number;
  trades: number;
  blocks: number;
  blockedLossAvoided: number;
  falseBlockCost: number;
}

export function championshipPnlScore(x: ObjectiveInput): number {
  return x.netPnl - 0.25 * x.maxDrawdown - 0.1 * x.fees;
}

export function safetyScore(x: ObjectiveInput): number {
  return x.netPnl - 2 * x.maxDrawdown - 0.5 * x.fees + x.blockedLossAvoided - x.falseBlockCost;
}

export function robustnessLabel(scorePnl: number, scoreSafety: number, minLeaveOneOutPnl: number, costStressPnl: number): "pass" | "watch" | "fragile" {
  if (minLeaveOneOutPnl < -5 || costStressPnl < -5) return "fragile";
  if (scorePnl > 0 && scoreSafety > -10) return "pass";
  return "watch";
}
