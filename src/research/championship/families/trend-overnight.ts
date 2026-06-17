import { baseConfig, candidate, type StrategyCandidate } from "../strategy-families";

export function trendOvernightCandidates(): StrategyCandidate[] {
  const out: StrategyCandidate[] = [];
  for (const maFast of [3, 5, 8]) {
    for (const maSlow of [13, 21, 34]) {
      if (maFast >= maSlow) continue;
      for (const supertrendAtr of [7, 10, 14]) {
        for (const supertrendMultiplier of [2, 3, 4]) {
          for (const minTrendStrength of [0.2, 0.5, 0.8]) {
            const cfg = baseConfig(`fast${maFast}_slow${maSlow}_atr${supertrendAtr}_mult${supertrendMultiplier}_str${minTrendStrength}`);
            cfg.source = "perp_gap";
            cfg.direction = "momentum";
            cfg.entryPct = minTrendStrength;
            cfg.exitPct = 0;
            cfg.takeProfitPct = supertrendMultiplier >= 3 ? 1.25 : 0.75;
            cfg.stopLossPct = Math.max(0.75, supertrendAtr / 10);
            cfg.maxHoldSnapshots = maSlow;
            cfg.notionalPct = 0.25;
            cfg.maxConcurrent = 3;
            out.push(candidate("TrendOvernight", cfg, { maFast, maSlow, supertrendAtr, supertrendMultiplier, minTrendStrength }));
          }
        }
      }
    }
  }
  return out;
}
