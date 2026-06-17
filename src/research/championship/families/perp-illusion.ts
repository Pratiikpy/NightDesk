import { baseConfig, candidate, type StrategyCandidate } from "../strategy-families";

export function perpIllusionFadeCandidates(): StrategyCandidate[] {
  const out: StrategyCandidate[] = [];
  for (const maxPerpGapBps of [10, 25, 50]) {
    for (const minTrueGapBps of [50, 100, 150]) {
      for (const maxSpreadBps of [20, 40, 80]) {
        for (const minTrackingGrade of ["A", "B", "C"]) {
          const cfg = baseConfig(`perp${maxPerpGapBps}_true${minTrueGapBps}_spread${maxSpreadBps}_grade${minTrackingGrade}`);
          cfg.source = "equity_gap";
          cfg.direction = "fade";
          cfg.entryPct = minTrueGapBps / 100;
          cfg.exitPct = maxPerpGapBps / 100;
          cfg.takeProfitPct = minTrueGapBps / 120;
          cfg.stopLossPct = Math.max(1.25, minTrueGapBps / 60);
          cfg.maxHoldSnapshots = 9999;
          cfg.notionalPct = maxSpreadBps <= 40 ? 0.45 : 0.25;
          cfg.maxConcurrent = minTrackingGrade === "A" ? 5 : 3;
          out.push(candidate("PerpIllusionFade", cfg, { maxPerpGapBps, minTrueGapBps, maxSpreadBps, minTrackingGrade }));
        }
      }
    }
  }
  return out;
}
