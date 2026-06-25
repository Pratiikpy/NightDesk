import type { Side } from "../bitsim/types";

export interface ImplementationShortfall {
  side: Side;
  quantity: number;
  decisionPrice: number;
  arrivalPrice: number;
  fillPrice: number;
  delayCost: number;
  executionCost: number;
  fees: number;
  totalCost: number;
  totalBps: number;
}

export function implementationShortfall(input: {
  side: Side;
  quantity: number;
  decisionPrice: number;
  arrivalPrice: number;
  fillPrice: number;
  fees?: number;
}): ImplementationShortfall {
  const { side, quantity, decisionPrice, arrivalPrice, fillPrice } = input;
  const fees = input.fees ?? 0;
  if (![quantity, decisionPrice, arrivalPrice, fillPrice, fees].every(Number.isFinite) || !(quantity > 0) || !(decisionPrice > 0) || !(arrivalPrice > 0) || !(fillPrice > 0) || fees < 0) {
    throw new Error("invalid implementation-shortfall input");
  }
  const direction = side === "buy" ? 1 : -1;
  const delayCost = direction * quantity * (arrivalPrice - decisionPrice);
  const executionCost = direction * quantity * (fillPrice - arrivalPrice);
  const totalCost = delayCost + executionCost + fees;
  return {
    side,
    quantity,
    decisionPrice,
    arrivalPrice,
    fillPrice,
    delayCost,
    executionCost,
    fees,
    totalCost,
    totalBps: (totalCost / (quantity * decisionPrice)) * 10_000,
  };
}
