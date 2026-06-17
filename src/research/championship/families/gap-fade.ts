import { baseConfig, candidate, type StrategyCandidate } from "../strategy-families";

export function gapFadeCandidates(): StrategyCandidate[] {
  const out: StrategyCandidate[] = [];
  for (const source of ["equity_gap", "perp_gap"] as const) {
    for (const entryGapPct of [0.1, 0.2, 0.35, 0.5, 0.75]) {
      for (const exitPct of [0, 0.05, 0.1]) {
        if (exitPct > entryGapPct) continue;
        for (const takeProfitPct of [0.75, 1.25, 2]) {
          for (const stopLossPct of [0.75, 1.25, 2.5]) {
            for (const maxHoldSnapshots of [15, 30, 90, 9999]) {
              for (const notionalPct of [0.25, 0.5, 0.65]) {
                for (const maxConcurrent of [2, 5, 8]) {
                  const cfg = baseConfig(`${source}_entry${entryGapPct}_exit${exitPct}_tp${takeProfitPct}_sl${stopLossPct}_h${maxHoldSnapshots}_n${notionalPct}_m${maxConcurrent}`);
                  cfg.source = source;
                  cfg.direction = "fade";
                  cfg.entryPct = entryGapPct;
                  cfg.exitPct = exitPct;
                  cfg.takeProfitPct = takeProfitPct;
                  cfg.stopLossPct = stopLossPct;
                  cfg.maxHoldSnapshots = maxHoldSnapshots;
                  cfg.notionalPct = notionalPct;
                  cfg.maxConcurrent = maxConcurrent;
                  out.push(candidate("GapFade", cfg, { source, entryGapPct, exitPct, takeProfitPct, stopLossPct, maxHoldSnapshots, notionalPct, maxConcurrent }));
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}
