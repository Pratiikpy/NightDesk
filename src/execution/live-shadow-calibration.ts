import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { spotBook, spotTicker } from "../bitget/client";
import { depthFill, quoteFill } from "../bitsim/fills";
import type { Side } from "../bitsim/types";
import { basisPairs } from "../universe";
import { implementationShortfall } from "./implementation-shortfall";

const OUT = join(process.cwd(), "evidence", "execution-v2");
const NOTIONALS = [25, 100, 500];

type Tier = "A" | "B" | "C" | "D";

interface CalibrationRow {
  ticker: string;
  symbol: string;
  tier: Tier;
  side: Side;
  requestedNotional: number;
  requestedQty: number;
  predictedQty: number;
  depthQty: number;
  predictedPrice: number | null;
  depthPrice: number | null;
  priceErrorBps: number | null;
  predictedCoveragePct: number;
  depthCoveragePct: number;
  depthShortfallBps: number | null;
}

function liquidityTier(book: { bids: [number, number][]; asks: [number, number][] }): Tier {
  if (!book.bids.length || !book.asks.length) return "D";
  const bidNotional = book.bids.reduce((sum, [price, qty]) => sum + price * qty, 0);
  const askNotional = book.asks.reduce((sum, [price, qty]) => sum + price * qty, 0);
  const twoSided = Math.min(bidNotional, askNotional);
  return twoSided >= 10_000 ? "A" : twoSided >= 2_000 ? "B" : "C";
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export async function runLiveShadowCalibration(): Promise<Record<string, unknown>> {
  mkdirSync(OUT, { recursive: true });
  const limit = pLimit(4);
  const errors: { symbol: string; error: string }[] = [];
  const groups = await Promise.all(basisPairs.map((pair) => limit(async (): Promise<CalibrationRow[]> => {
    try {
      const [ticker, book] = await Promise.all([spotTicker(pair.rtoken_spot), spotBook(pair.rtoken_spot, 50)]);
      if (ticker.bid == null || ticker.ask == null) throw new Error("two-sided ticker unavailable");
      const tier = liquidityTier(book);
      const rows: CalibrationRow[] = [];
      for (const side of ["buy", "sell"] as const) {
        const touch = side === "buy" ? ticker.ask : ticker.bid;
        for (const requestedNotional of NOTIONALS) {
          const requestedQty = requestedNotional / touch;
          const predicted = quoteFill(side, requestedQty, ticker);
          const depth = depthFill(side, requestedQty, book);
          const priceErrorBps = predicted.avgPrice != null && depth.avgPrice != null
            ? Math.abs(predicted.avgPrice - depth.avgPrice) / depth.avgPrice * 10_000
            : null;
          const depthShortfallBps = depth.avgPrice != null && depth.fillQty > 0
            ? implementationShortfall({
                side,
                quantity: depth.fillQty,
                decisionPrice: touch,
                arrivalPrice: touch,
                fillPrice: depth.avgPrice,
                fees: depth.fillQty * depth.avgPrice * 0.001,
              }).totalBps
            : null;
          rows.push({
            ticker: pair.ticker,
            symbol: pair.rtoken_spot,
            tier,
            side,
            requestedNotional,
            requestedQty,
            predictedQty: predicted.fillQty,
            depthQty: depth.fillQty,
            predictedPrice: predicted.avgPrice,
            depthPrice: depth.avgPrice,
            priceErrorBps,
            predictedCoveragePct: predicted.fillQty / requestedQty * 100,
            depthCoveragePct: depth.fillQty / requestedQty * 100,
            depthShortfallBps,
          });
        }
      }
      return rows;
    } catch (error) {
      errors.push({ symbol: pair.rtoken_spot, error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  })));
  const rows = groups.flat();
  const symbols = new Set(rows.map((row) => row.symbol));
  const tiers = (["A", "B", "C", "D"] as const).map((tier) => {
    const tierRows = rows.filter((row) => row.tier === tier);
    const priceErrors = tierRows.map((row) => row.priceErrorBps).filter((value): value is number => value != null && Number.isFinite(value));
    return {
      tier,
      symbols: new Set(tierRows.map((row) => row.symbol)).size,
      cases: tierRows.length,
      meanPriceErrorBps: mean(priceErrors),
      maxPriceErrorBps: priceErrors.length ? Math.max(...priceErrors) : null,
      meanPredictedCoveragePct: mean(tierRows.map((row) => row.predictedCoveragePct)),
      meanDepthCoveragePct: mean(tierRows.map((row) => row.depthCoveragePct)),
      meanDepthShortfallBps: mean(tierRows.map((row) => row.depthShortfallBps).filter((value): value is number => value != null)),
    };
  });
  const executableSymbols = new Set(rows.filter((row) => row.tier !== "D").map((row) => row.symbol)).size;
  const success = symbols.size === basisPairs.length && rows.length === basisPairs.length * NOTIONALS.length * 2;
  const payload = {
    schema: "nightdesk.live-shadow-calibration.v1",
    generatedAt: new Date().toISOString(),
    mode: "public-read-only",
    credentialsUsed: false,
    writesEnabled: false,
    universeSize: basisPairs.length,
    symbolsCalibrated: symbols.size,
    executableSymbols,
    cases: rows.length,
    notionals: NOTIONALS,
    success,
    tiers,
    errors,
    rows,
  };
  const headers = Object.keys(rows[0] ?? { ticker: "", symbol: "", tier: "", side: "", requestedNotional: "", requestedQty: "", predictedQty: "", depthQty: "", predictedPrice: "", depthPrice: "", priceErrorBps: "", predictedCoveragePct: "", depthCoveragePct: "", depthShortfallBps: "" });
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => String(row[header as keyof CalibrationRow] ?? "")).join(","))].join("\n") + "\n";
  writeFileSync(join(OUT, "live-shadow-calibration.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(join(OUT, "live-shadow-calibration.csv"), csv);
  writeFileSync(join(OUT, "live-shadow-calibration.md"), [
    "# Live Shadow Execution Calibration",
    "",
    `Mode: public read-only. Credentials used: no. Writes enabled: no.`,
    `Coverage: ${symbols.size}/${basisPairs.length} symbols, ${rows.length} hypothetical execution cases.`,
    "",
    "| Liquidity tier | Symbols | Cases | Mean model error (bps) | Max error (bps) | Predicted fill % | Depth fill % | Mean depth shortfall (bps) |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...tiers.map((tier) => `| ${tier.tier} | ${tier.symbols} | ${tier.cases} | ${tier.meanPriceErrorBps?.toFixed(3) ?? "n/a"} | ${tier.maxPriceErrorBps?.toFixed(3) ?? "n/a"} | ${tier.meanPredictedCoveragePct?.toFixed(2) ?? "n/a"} | ${tier.meanDepthCoveragePct?.toFixed(2) ?? "n/a"} | ${tier.meanDepthShortfallBps?.toFixed(3) ?? "n/a"} |`),
    "",
    "The comparison uses simultaneous public ticker and depth snapshots. It is a shadow calibration receipt, not a real fill claim.",
  ].join("\n") + "\n");
  console.log(`NIGHTDESK LIVE SHADOW CALIBRATION: ${success ? "PASS" : "FAIL"} (${symbols.size}/${basisPairs.length} symbols, ${rows.length} cases)`);
  if (!success) process.exitCode = 1;
  return payload;
}

if (process.argv[1]?.endsWith("live-shadow-calibration.ts")) {
  runLiveShadowCalibration().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
