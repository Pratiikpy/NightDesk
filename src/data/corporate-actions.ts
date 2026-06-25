import type { ProvenanceEvent } from "./provenance";

export type CorporateActionType = "split" | "cash_dividend";

export interface CorporateActionPayload {
  actionType: CorporateActionType;
  ticker: string;
  announcedAt: number;
  exDate: string;
  ratioFrom?: number;
  ratioTo?: number;
  cashAmount?: number;
  currency?: string;
}

export function knownCorporateActions(events: ProvenanceEvent[], asOfReceivedAt: number, ticker?: string): ProvenanceEvent<CorporateActionPayload>[] {
  const normalizedTicker = ticker?.toUpperCase();
  return events
    .filter((event): event is ProvenanceEvent<CorporateActionPayload> => event.kind === "corporate.action")
    .filter((event) => event.receivedAt <= asOfReceivedAt)
    .filter((event) => event.quality.status !== "quarantined")
    .filter((event) => !normalizedTicker || event.instrument === normalizedTicker)
    .sort((a, b) => a.effectiveAt - b.effectiveAt || a.receivedAt - b.receivedAt || a.eventId.localeCompare(b.eventId));
}

export function splitAdjustmentFactor(
  actions: ProvenanceEvent<CorporateActionPayload>[],
  priceTimestamp: number,
  targetTimestamp: number,
): number {
  if (targetTimestamp < priceTimestamp) throw new Error("targetTimestamp cannot precede priceTimestamp");
  let factor = 1;
  for (const action of actions) {
    if (action.payload.actionType !== "split") continue;
    if (action.effectiveAt <= priceTimestamp || action.effectiveAt > targetTimestamp) continue;
    const from = action.payload.ratioFrom;
    const to = action.payload.ratioTo;
    if (!Number.isFinite(from) || !Number.isFinite(to) || Number(from) <= 0 || Number(to) <= 0) {
      throw new Error(`invalid split ratio in ${action.eventId}`);
    }
    factor *= Number(from) / Number(to);
  }
  return factor;
}

export function adjustHistoricalPriceForSplits(
  price: number,
  actions: ProvenanceEvent<CorporateActionPayload>[],
  priceTimestamp: number,
  targetTimestamp: number,
): number {
  if (!Number.isFinite(price) || price <= 0) throw new Error("price must be positive and finite");
  return price * splitAdjustmentFactor(actions, priceTimestamp, targetTimestamp);
}
