import type { FillModelName } from "./events";

export interface FillModelProfile {
  name: FillModelName;
  baseSlipPct: number;
  impactPct: number;
  description: string;
}

export const FILL_MODELS: Record<FillModelName, FillModelProfile> = {
  best_price: { name: "best_price", baseSlipPct: 0, impactPct: 0, description: "optimistic touch fill" },
  one_tick_slippage: { name: "one_tick_slippage", baseSlipPct: 0.02, impactPct: 0.02, description: "small fixed slippage on the touch" },
  size_aware: { name: "size_aware", baseSlipPct: 0, impactPct: 0.05, description: "NightDesk default size-aware quote model" },
  market_hours: { name: "market_hours", baseSlipPct: 0.01, impactPct: 0.04, description: "regular-session paper fill model" },
  volume_sensitive: { name: "volume_sensitive", baseSlipPct: 0.03, impactPct: 0.08, description: "thin-volume stress fill model" },
  competition_aware: { name: "competition_aware", baseSlipPct: 0.05, impactPct: 0.12, description: "assumes other agents consume part of edge" },
  partial_limit_fill: { name: "partial_limit_fill", baseSlipPct: 0.02, impactPct: 0.06, description: "limit-order model with partial-fill bias" },
};

export function fillModelConfig(name: FillModelName = "size_aware"): { baseSlipPct: number; impactPct: number; refNotional: number } {
  const m = FILL_MODELS[name];
  return { baseSlipPct: m.baseSlipPct, impactPct: m.impactPct, refNotional: 5_000 };
}
