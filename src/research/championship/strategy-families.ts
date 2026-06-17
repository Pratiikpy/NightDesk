import type { AlphaConfig } from "../alpha-championship";

export type ChampionshipFamily =
  | "GapFade"
  | "GridAroundAnchor"
  | "VolTargetGapFade"
  | "CrossSectionMomentum"
  | "TrendOvernight"
  | "PerpIllusionFade";

export interface StrategyCandidate {
  family: ChampionshipFamily;
  config: AlphaConfig;
  params: Record<string, number | string>;
  hardSafety: {
    staleAnchorBlock: true;
    newsMacroBlock: true;
    issuerRiskBlock: true;
    liquidityTrapBlock: true;
    feeSlippageEdgeCheck: true;
  };
}

export function candidate(family: ChampionshipFamily, config: AlphaConfig, params: Record<string, number | string>): StrategyCandidate {
  return {
    family,
    config: { ...config, id: `${family}_${config.id}`.replace(/[^a-zA-Z0-9_]/g, "_") },
    params,
    hardSafety: {
      staleAnchorBlock: true,
      newsMacroBlock: true,
      issuerRiskBlock: true,
      liquidityTrapBlock: true,
      feeSlippageEdgeCheck: true,
    },
  };
}

export function baseConfig(id: string): AlphaConfig {
  return {
    id,
    source: "equity_gap",
    direction: "fade",
    entryPct: 0.35,
    exitPct: 0.05,
    takeProfitPct: 0.75,
    stopLossPct: 2,
    maxHoldSnapshots: 30,
    notionalPct: 0.25,
    maxConcurrent: 3,
    feePct: 0.1,
  };
}
