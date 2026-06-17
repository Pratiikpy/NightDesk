import { baseConfig, candidate, type StrategyCandidate } from "../strategy-families";

export function gapGridCandidates(): StrategyCandidate[] {
  const out: StrategyCandidate[] = [];
  for (const entryGapBps of [20, 40, 60, 80, 120]) {
    for (const gridStepBps of [10, 20, 30]) {
      for (const maxGridLevels of [1, 2, 3]) {
        for (const takeProfitBps of [10, 20, 40]) {
          const cfg = baseConfig(`entry${entryGapBps}_grid${gridStepBps}_levels${maxGridLevels}_tp${takeProfitBps}`);
          cfg.entryPct = entryGapBps / 100;
          cfg.exitPct = Math.min(cfg.entryPct, gridStepBps / 100);
          cfg.takeProfitPct = takeProfitBps / 100;
          cfg.stopLossPct = Math.max(0.8, (entryGapBps + gridStepBps * maxGridLevels) / 100);
          cfg.maxHoldSnapshots = 90;
          cfg.notionalPct = Math.min(0.55, 0.15 * maxGridLevels);
          cfg.maxConcurrent = Math.min(8, maxGridLevels * 2);
          out.push(candidate("GridAroundAnchor", cfg, { entryGapBps, gridStepBps, maxGridLevels, takeProfitBps }));
        }
      }
    }
  }
  return out;
}
