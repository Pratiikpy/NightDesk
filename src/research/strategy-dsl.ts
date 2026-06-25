import { createHash } from "node:crypto";
import type { AlphaConfig } from "./alpha-championship";

export interface StrategyDslV1 {
  schema: "nightdesk.strategy.v1";
  id: string;
  signal: { source: "equity_gap" | "perp_gap"; direction: "fade" | "momentum"; entryPct: number };
  filters: { eventPolicy: "hard-gates"; liquidityPolicy: "positive-depth"; anchorPolicy: "two-source-consensus" };
  sizing: { method: "equity-fraction"; notionalPct: number; maxConcurrent: number };
  entry: { orderType: "marketable-limit"; thresholdPct: number };
  exit: { convergencePct: number; takeProfitPct: number; stopLossPct: number; maxHoldSnapshots: number };
  hedge: { mode: "none" | "informational-perp" };
  risk: { certificateRequired: true; hardGatesRequired: true };
  costs: { feePct: number; fillModel: "depth-or-visible-quote" };
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
}

export function strategyHash(strategy: StrategyDslV1): string {
  return createHash("sha256").update(stable(strategy)).digest("hex");
}

export function alphaConfigToDsl(config: AlphaConfig): StrategyDslV1 {
  return {
    schema: "nightdesk.strategy.v1",
    id: config.id,
    signal: { source: config.source, direction: config.direction, entryPct: config.entryPct },
    filters: { eventPolicy: "hard-gates", liquidityPolicy: "positive-depth", anchorPolicy: "two-source-consensus" },
    sizing: { method: "equity-fraction", notionalPct: config.notionalPct, maxConcurrent: config.maxConcurrent },
    entry: { orderType: "marketable-limit", thresholdPct: config.entryPct },
    exit: { convergencePct: config.exitPct, takeProfitPct: config.takeProfitPct, stopLossPct: config.stopLossPct, maxHoldSnapshots: config.maxHoldSnapshots },
    hedge: { mode: config.source === "perp_gap" ? "informational-perp" : "none" },
    risk: { certificateRequired: true, hardGatesRequired: true },
    costs: { feePct: config.feePct, fillModel: "depth-or-visible-quote" },
  };
}

export function validateStrategyDsl(strategy: StrategyDslV1): string[] {
  const errors: string[] = [];
  if (strategy.schema !== "nightdesk.strategy.v1") errors.push("unsupported schema");
  if (!strategy.id) errors.push("id required");
  const finiteNonNegative = [strategy.signal.entryPct, strategy.sizing.notionalPct, strategy.exit.convergencePct, strategy.exit.takeProfitPct, strategy.exit.stopLossPct, strategy.costs.feePct];
  if (!finiteNonNegative.every((value) => Number.isFinite(value) && value >= 0)) errors.push("numeric fields must be finite and non-negative");
  if (!(strategy.sizing.notionalPct > 0 && strategy.sizing.notionalPct <= 1)) errors.push("notionalPct must be in (0,1]");
  if (!Number.isInteger(strategy.sizing.maxConcurrent) || strategy.sizing.maxConcurrent < 1) errors.push("maxConcurrent must be a positive integer");
  if (!Number.isInteger(strategy.exit.maxHoldSnapshots) || strategy.exit.maxHoldSnapshots < 1) errors.push("maxHoldSnapshots must be a positive integer");
  if (!strategy.risk.certificateRequired || !strategy.risk.hardGatesRequired) errors.push("hard risk controls cannot be disabled");
  return errors;
}
