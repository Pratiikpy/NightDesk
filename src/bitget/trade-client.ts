// Authenticated Bitget V2 client — the REAL trading path (signed requests against the private API).
// Kept separate from the read-only public client. Every call returns the raw Bitget response (code/msg)
// instead of throwing, so a proof tool can record the real server reply either way (success OR a
// real authenticated rejection like "no trade permission"). Credentials come from env only.
import { createHmac } from "node:crypto";

const BASE = "https://api.bitget.com";

export interface Creds {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

export function credsFromEnv(): Creds | null {
  const apiKey = process.env.BITGET_API_KEY ?? "";
  const secretKey = process.env.BITGET_SECRET_KEY ?? "";
  const passphrase = process.env.BITGET_PASSPHRASE ?? "";
  if (!apiKey || !secretKey || !passphrase) return null;
  return { apiKey, secretKey, passphrase };
}

/** Bitget V2 signature: base64( HMAC-SHA256( timestamp + METHOD + requestPath(+query) + body, secret ) ). */
function sign(timestamp: string, method: string, requestPath: string, body: string, secret: string): string {
  return createHmac("sha256", secret).update(timestamp + method.toUpperCase() + requestPath + body).digest("base64");
}

export interface AuthedResult<T = unknown> {
  ok: boolean; // true only when Bitget code === "00000"
  httpStatus: number;
  code: string;
  msg: string;
  data: T | null;
  requestPath: string;
  method: string;
}

async function authed<T>(creds: Creds, method: "GET" | "POST", path: string, query: Record<string, string> = {}, body?: object): Promise<AuthedResult<T>> {
  const qs = new URLSearchParams(query).toString();
  const requestPath = qs ? `${path}?${qs}` : path;
  const bodyStr = body ? JSON.stringify(body) : "";
  const ts = Date.now().toString();
  const headers: Record<string, string> = {
    "ACCESS-KEY": creds.apiKey,
    "ACCESS-SIGN": sign(ts, method, requestPath, bodyStr, creds.secretKey),
    "ACCESS-TIMESTAMP": ts,
    "ACCESS-PASSPHRASE": creds.passphrase,
    "Content-Type": "application/json",
    locale: "en-US",
  };
  try {
    const res = await fetch(BASE + requestPath, { method, headers, body: bodyStr || undefined, signal: AbortSignal.timeout(10_000) });
    const json = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
    return {
      ok: json.code === "00000",
      httpStatus: res.status,
      code: json.code ?? String(res.status),
      msg: json.msg ?? "",
      data: json.data ?? null,
      requestPath,
      method,
    };
  } catch (e) {
    return { ok: false, httpStatus: 0, code: "NETWORK", msg: (e as Error).message, data: null, requestPath, method };
  }
}

/** Read-only authenticated probe: proves the credentials sign correctly against the PRIVATE API. */
export function getSpotAccountAssets(creds: Creds): Promise<AuthedResult> {
  return authed(creds, "GET", "/api/v2/spot/account/assets");
}

export interface PlaceLimitOrder {
  symbol: string;
  side: "buy" | "sell";
  price: string; // limit price (string, exchange precision)
  size: string; // base quantity
}

/** Place a spot limit order. Returns the raw Bitget response (orderId on success, or a real rejection). */
export function placeSpotLimitOrder(creds: Creds, o: PlaceLimitOrder): Promise<AuthedResult<{ orderId: string; clientOid: string }>> {
  return authed(creds, "POST", "/api/v2/spot/trade/place-order", {}, {
    symbol: o.symbol,
    side: o.side,
    orderType: "limit",
    force: "gtc",
    price: o.price,
    size: o.size,
  });
}

export function cancelSpotOrder(creds: Creds, symbol: string, orderId: string): Promise<AuthedResult<{ orderId: string }>> {
  return authed(creds, "POST", "/api/v2/spot/trade/cancel-order", {}, { symbol, orderId });
}

export function getSpotOrderInfo(creds: Creds, symbol: string, orderId: string): Promise<AuthedResult> {
  return authed(creds, "GET", "/api/v2/spot/trade/orderInfo", { symbol, orderId });
}
