import { baseConfig, candidate, type StrategyCandidate } from "../strategy-families";

export function volTargetGapCandidates(): StrategyCandidate[] {
  const out: StrategyCandidate[] = [];
  for (const volLookback of [3, 5, 10, 20]) {
    for (const targetVol of [10, 15, 20, 30]) {
      for (const maxNotional of [25, 50, 100, 200]) {
        for (const minGapBps of [30, 60, 100]) {
          const cfg = baseConfig(`vol${volLookback}_target${targetVol}_cap${maxNotional}_gap${minGapBps}`);
          cfg.entryPct = minGapBps / 100;
          cfg.exitPct = 0.05;
          cfg.takeProfitPct = Math.max(0.4, minGapBps / 120);
          cfg.stopLossPct = Math.max(1, minGapBps / 50);
          cfg.maxHoldSnapshots = volLookback <= 5 ? 30 : 90;
          cfg.notionalPct = Math.min(0.65, maxNotional / 300);
          cfg.maxConcurrent = targetVol >= 20 ? 5 : 3;
          out.push(candidate("VolTargetGapFade", cfg, { volLookback, targetVol, maxNotional, minGapBps }));
        }
      }
    }
  }
  return out;
}
