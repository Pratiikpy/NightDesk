// Live trade proof — the REAL on-platform execution evidence (the dust-trade alternative).
//
// Default: a real AUTHENTICATED round-trip against Bitget's PRIVATE API (signed request -> real server
// reply). This proves real credentials + signing work end-to-end, not just public reads.
//
// `--execute` (double-gated by NIGHTDESK_LIVE_ORDER=1): places a REAL spot limit order that is
// NON-FILLABLE BY CONSTRUCTION — a BUY limit at 50% below the market price, which rests in the book and
// can never fill — then immediately cancels it. The result is a real Bitget order id and a real
// place/cancel lifecycle, at zero cost and zero fill risk. Everything is hashed into the audit chain.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { basisPairs } from "../universe";
import { spotTicker } from "../bitget/client";
import { credsFromEnv, getSpotAccountAssets, placeSpotLimitOrder, cancelSpotOrder, getSpotOrderInfo } from "../bitget/trade-client";
import { hashRecords } from "./exporter";

const OUT = join(process.cwd(), "evidence", "live-receipt");

/** Summarize account assets WITHOUT dumping balances (proves reachability, not amounts). */
function summarizeAssets(data: unknown): object {
  if (!Array.isArray(data)) return { account: "reachable" };
  return { coins: data.length, hasUSDT: data.some((a: { coin?: string }) => a.coin === "USDT") };
}

export async function runLiveTradeProof(args: string[] = []): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const creds = credsFromEnv();
  const symbol = basisPairs[0]?.rtoken_spot ?? "RAAPLUSDT";
  const runId = `livetrade_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const wantExecute = args.includes("--execute");
  const armed = wantExecute && process.env.NIGHTDESK_LIVE_ORDER === "1";

  const steps: Record<string, unknown>[] = [];
  const record = (name: string, detail: Record<string, unknown>) => {
    steps.push({ name, at: new Date().toISOString(), ...detail });
    console.log(`[live-trade-proof] ${name}: ${JSON.stringify(detail).slice(0, 160)}`);
  };

  if (!creds) {
    record("credentials", { ok: false, note: "No Bitget credentials in env (BITGET_API_KEY/SECRET_KEY/PASSPHRASE)." });
  } else {
    const assets = await getSpotAccountAssets(creds);
    record("authenticated_account_probe", {
      ok: assets.ok,
      httpStatus: assets.httpStatus,
      code: assets.code,
      msg: assets.msg,
      summary: assets.ok ? summarizeAssets(assets.data) : null,
      requestPath: assets.requestPath,
      proves: "real credentials sign correctly against Bitget's authenticated API",
    });
  }

  let orderRoundTrip: Record<string, unknown> | null = null;
  if (creds && armed) {
    const tk = await spotTicker(symbol).catch(() => null);
    const ref = tk?.bid ?? tk?.last ?? null;
    if (ref && ref > 0) {
      const price = (ref * 0.5).toFixed(2); // 50% below market: a BUY limit here cannot fill
      const notional = Number(process.env.NIGHTDESK_LIVE_DUST_NOTIONAL_USD ?? "5");
      const size = Math.max(notional / Number(price), 0.0001).toFixed(4);
      const place = await placeSpotLimitOrder(creds, { symbol, side: "buy", price, size });
      const orderId = place.data?.orderId ?? null;
      record("place_order", { ok: place.ok, code: place.code, msg: place.msg, symbol, side: "buy", price, size, marketRef: ref, orderId });
      let cancelOk = false;
      if (orderId) {
        const info = await getSpotOrderInfo(creds, symbol, orderId);
        const status = Array.isArray(info.data) ? (info.data[0] as { status?: string } | undefined)?.status : null;
        record("order_status", { ok: info.ok, code: info.code, status: status ?? null, note: "non-fillable limit resting far below market" });
        const cancel = await cancelSpotOrder(creds, symbol, orderId);
        cancelOk = cancel.ok;
        record("cancel_order", { ok: cancel.ok, code: cancel.code, msg: cancel.msg, orderId });
      }
      orderRoundTrip = { symbol, side: "buy", price, size, marketRef: ref, orderId, placed: place.ok, cancelled: cancelOk };
    } else {
      record("place_order", { ok: false, note: "no live market price available for the non-fillable order" });
    }
  } else if (creds && wantExecute && !armed) {
    record("execute_gated", { note: "--execute requires NIGHTDESK_LIVE_ORDER=1 (double-gate). No real order placed." });
  }

  const ledgerHash = hashRecords(steps);
  const mode = armed ? "real_order_round_trip" : creds ? "authenticated_probe" : "no_credentials";
  const receipt = {
    runId,
    generatedAt: new Date().toISOString(),
    mode,
    symbol,
    note: "Real authenticated Bitget round-trip. The order path uses a non-fillable limit (50% below market) plus an immediate cancel, so it can never fill and costs nothing. Read-only by default; the real order is double-gated (--execute + NIGHTDESK_LIVE_ORDER=1).",
    steps,
    orderRoundTrip,
    ledgerHash,
  };
  writeFileSync(join(OUT, "real-order-roundtrip.json"), JSON.stringify(receipt, null, 2) + "\n");
  writeFileSync(
    join(OUT, "real-order-roundtrip.md"),
    [
      "# Live Trade Proof — real authenticated Bitget round-trip",
      "",
      `Run ID: ${runId}`,
      `Mode: ${mode}`,
      `Symbol: ${symbol}`,
      `Ledger hash: ${ledgerHash}`,
      "",
      "## Steps",
      ...steps.map((s) => `- ${s.name}: ${JSON.stringify({ ...s, name: undefined, at: undefined })}`),
      "",
      "The order path is non-fillable by construction (buy limit 50% below market) and immediately",
      "cancelled, so it generates a real Bitget order lifecycle at zero cost and zero fill risk.",
      "Default is read-only authenticated; the real order is double-gated.",
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK LIVE TRADE PROOF COMPLETE (${mode}): ${join(OUT, "real-order-roundtrip.json")}`);
}

if (process.argv[1]?.endsWith("live-trade-proof.ts")) runLiveTradeProof(process.argv.slice(2));
