import { baseConfig, candidate, type StrategyCandidate } from "../strategy-families";

export function crossSectionMomentumCandidates(): StrategyCandidate[] {
  const out: StrategyCandidate[] = [];
  for (const lookbackMinutes of [60, 180, 360, 720]) {
    for (const topK of [1, 2, 3, 5]) {
      for (const rebalanceMinutes of [30, 60, 180]) {
        for (const minLiquidityScore of [0.5, 0.7, 0.85]) {
          const cfg = baseConfig(`look${lookbackMinutes}_top${topK}_reb${rebalanceMinutes}_liq${minLiquidityScore}`);
          cfg.source = "equity_gap";
          cfg.direction = "momentum";
          cfg.entryPct = minLiquidityScore >= 0.85 ? 0.2 : 0.35;
          cfg.exitPct = 0.05;
          cfg.takeProfitPct = lookbackMinutes >= 360 ? 1.5 : 0.75;
          cfg.stopLossPct = minLiquidityScore >= 0.7 ? 1.25 : 2;
          cfg.maxHoldSnapshots = Math.max(5, Math.round(rebalanceMinutes / 5));
          cfg.notionalPct = Math.min(0.5, 0.15 * topK);
          cfg.maxConcurrent = topK;
          out.push(candidate("CrossSectionMomentum", cfg, { lookbackMinutes, topK, rebalanceMinutes, minLiquidityScore }));
        }
      }
    }
  }
  return out;
}
