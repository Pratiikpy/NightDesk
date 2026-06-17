#!/usr/bin/env tsx
// NightDesk MCP server — exposes the tokenized-stock risk desk over the Model Context Protocol
// (stdio transport) so any MCP client (Claude, Cursor, Codex, a Bitget Agent Hub agent) can ask
// NightDesk for the true gap, its cause, the quality grade, and can re-verify the signed ledger.
// Read-only by design (analysis + audit; order execution lives in the separate PaperPit MCP sandbox).
// Zero dependencies beyond the project's own modules — MCP stdio is newline-delimited JSON-RPC 2.0.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { collect } from "../pegwatch/collect";
import { classifyGap } from "../perception/causality";
import { MarketEventProvider } from "../perception/events";
import { verifyLedgerFile } from "../ledger/verify";
import { buildScorecard, summarizeJudgment } from "../ledger/scorecard";
import { certifyToken, type TokenCert } from "../research/certify";
import { issueCertificate, type NightDeskCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PegRow } from "../pegwatch/collect";
import type { CycleRecord } from "../ledger/ledger";

// CRITICAL: stdout is the JSON-RPC channel. Route any stray logging to stderr so it can't corrupt it.
console.log = (...a: unknown[]) => process.stderr.write(a.map(String).join(" ") + "\n");

const provider = new MarketEventProvider();
let deskCache: { at: number; rows: Record<string, unknown>[]; isoTime: string } | null = null;

async function riskDesk() {
  if (deskCache && Date.now() - deskCache.at < 60_000) return deskCache;
  const snap = await collect();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => provider.contextFor(r.ticker, snap.ts))));
  const rows = snap.rows.map((r, i) => {
    const c = classifyGap(r, ctxs[i]!);
    return {
      ticker: r.ticker,
      rPrice: r.rToken?.mid ?? null,
      anchorPrice: r.equity?.price ?? null,
      marketState: r.equity?.marketState ?? null,
      trueGapPct: c.trueGapPct,
      perpGapPct: c.perpGapPct,
      type: c.type,
      action: c.action,
      evidence: c.evidence,
      note: c.note,
    };
  });
  deskCache = { at: Date.now(), rows, isoTime: snap.isoTime };
  return deskCache;
}

function loadLedger(date?: string): { file: string; records: CycleRecord[] } {
  const day = date ?? new Date().toISOString().slice(0, 10);
  const file = join(process.cwd(), "data", "ledger", `${day}.jsonl`);
  if (!existsSync(file)) return { file, records: [] };
  const records = readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as CycleRecord);
  return { file, records };
}

function readQuality(): unknown {
  const file = join(process.cwd(), "data", "research", "token-quality.json");
  if (!existsSync(file)) return { present: false, note: "run `npm run flags` to generate the quality board", rows: [] };
  try {
    return { present: true, rows: JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    return { present: false, rows: [] };
  }
}

type CertEntry = { cert: TokenCert; anchorSource: "NYSE_LIVE" | "LAST_CLOSE" | "NONE"; anchorStale: boolean };
let certCache: { at: number; isoTime: string; entries: Map<string, CertEntry> } | null = null;
async function certUniverse() {
  if (certCache && Date.now() - certCache.at < 60_000) return certCache;
  const snap = await collect();
  const lim = pLimit(5);
  const ctxs = await Promise.all(snap.rows.map((r) => lim(() => provider.contextFor(r.ticker, snap.ts))));
  const entries = new Map<string, CertEntry>();
  snap.rows.forEach((r: PegRow, i) => {
    entries.set(r.ticker, {
      cert: certifyToken(r, ctxs[i]!),
      anchorStale: r.equity == null,
      anchorSource: r.equity == null ? "NONE" : r.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
    });
  });
  certCache = { at: Date.now(), isoTime: snap.isoTime, entries };
  return certCache;
}
const issueFor = (e: CertEntry): NightDeskCertificate => issueCertificate(e.cert, { anchorSource: e.anchorSource, anchorStale: e.anchorStale });

const TOOLS = [
  {
    name: "evaluate_intent",
    description:
      "THE FIREWALL. Submit an agent trade intent {ticker, side, sizeUsd}; NightDesk issues a fresh signed certificate and returns the enforcement verdict (ALLOW / ALLOW_CAPPED / REJECT) + reason. News-driven / stale / liquidity-trap / oversize / short-on-long-only-token → REJECT. This is the gate every agent must pass before trading a Bitget tokenized stock.",
    inputSchema: { type: "object", properties: { ticker: { type: "string" }, side: { type: "string", enum: ["buy", "sell"] }, sizeUsd: { type: "number" } }, required: ["ticker", "side", "sizeUsd"] },
  },
  {
    name: "certify_token",
    description: "Issue a signed, expiring NightDeskCertificate for one ticker: classification, safety score, allowed policy, max size, expiry, Ed25519 signature.",
    inputSchema: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
  },
  {
    name: "score_universe",
    description: "Certify the whole tokenized-stock universe: per-token classification, safety score (0–100, NOT alpha) and allowed agent policy.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_risk_desk",
    description:
      "The full tokenized-stock risk desk: for every Bitget rToken, the true gap vs the real-stock anchor (latest NYSE print — live in market hours, last official close off-hours), the perp gap that hides it, the classified cause (noise/news/earnings/macro/issuer/perp-illusion/liquidity-trap) and the action (fade/abstain/avoid).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_true_gap",
    description: "The true gap, cause and action for one ticker (e.g. NVDA).",
    inputSchema: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
  },
  {
    name: "get_quality_board",
    description: "A–D reliability grade per tokenized stock (tracking/stability/liquidity; legal rights excluded — never fabricated). Reads the saved board.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "verify_ledger",
    description: "Re-verify the Ed25519-signed decision ledger for a day (default: today). Returns signature validity, hash match, and tamper-evidence.",
    inputSchema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD (optional)" } } },
  },
  {
    name: "get_scorecard",
    description: "A day's graded scorecard plus the counterfactual judgment (graded trades, and graded abstentions/blocked trades). Default: today.",
    inputSchema: { type: "object", properties: { date: { type: "string" } } },
  },
];

async function callTool(name: string, args: Record<string, any>): Promise<unknown> {
  switch (name) {
    case "evaluate_intent": {
      const t = String(args.ticker || "").toUpperCase();
      const u = await certUniverse();
      const e = u.entries.get(t);
      if (!e) throw new Error(`no such ticker in the basis universe: ${t}`);
      const cert = issueFor(e);
      const dec = evaluateIntent({ ticker: t, side: args.side === "sell" ? "sell" : "buy", sizeUsd: Number(args.sizeUsd) || 0, certificate: cert });
      return { ...dec, classification: cert.payload.classification, allowedPolicy: cert.payload.allowedPolicy, safetyScore: cert.payload.safetyScore, maxSizeUsd: cert.payload.maxSizeUsd, certificateExpiresAt: cert.payload.expiresAt };
    }
    case "certify_token": {
      const t = String(args.ticker || "").toUpperCase();
      const u = await certUniverse();
      const e = u.entries.get(t);
      if (!e) throw new Error(`no such ticker in the basis universe: ${t}`);
      return issueFor(e);
    }
    case "score_universe": {
      const u = await certUniverse();
      return {
        asOf: u.isoTime,
        tokens: [...u.entries.values()].map((e) => ({ ticker: e.cert.ticker, classification: e.cert.classification, safetyScore: e.cert.safetyScore, policy: e.cert.policy, trueGapPct: e.cert.trueGapPct })),
      };
    }
    case "get_risk_desk": {
      const d = await riskDesk();
      return { asOf: d.isoTime, tokens: d.rows.length, perpIllusion: d.rows.filter((r) => r.type === "PERP_ILLUSION").length, rows: d.rows };
    }
    case "get_true_gap": {
      const t = String(args.ticker || "").toUpperCase();
      const d = await riskDesk();
      const row = d.rows.find((r) => r.ticker === t);
      if (!row) throw new Error(`no such ticker in the basis universe: ${t}`);
      return row;
    }
    case "get_quality_board":
      return readQuality();
    case "verify_ledger": {
      const { file, records } = loadLedger(args.date);
      if (!records.length) return { present: false, file, note: "no ledger for that day — run `npm run simulate`" };
      return verifyLedgerFile(file);
    }
    case "get_scorecard": {
      const { records } = loadLedger(args.date);
      return { scorecard: buildScorecard(records), judgment: summarizeJudgment(records) };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ── JSON-RPC 2.0 over stdio (newline-delimited) ──
function send(msg: unknown): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg: any): Promise<void> {
  const { id, method, params } = msg ?? {};
  if (method == null) return; // a response/garbage — ignore
  const isNotification = id === undefined || id === null;
  try {
    let result: unknown;
    if (method === "initialize") {
      result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "nightdesk", version: "0.1.0" } };
    } else if (method === "tools/list") {
      result = { tools: TOOLS };
    } else if (method === "tools/call") {
      const out = await callTool(params?.name, params?.arguments ?? {});
      result = { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } else if (method === "ping") {
      result = {};
    } else if (isNotification) {
      return; // unknown notification (e.g. notifications/initialized) — nothing to do
    } else {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
      return;
    }
    if (!isNotification) send({ jsonrpc: "2.0", id, result });
  } catch (e) {
    if (!isNotification) send({ jsonrpc: "2.0", id, error: { code: -32000, message: (e as Error).message } });
  }
}

let buf = "";
const pending = new Set<Promise<void>>();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buf += chunk;
  let nl: number;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const p = handle(JSON.parse(line)).finally(() => pending.delete(p));
      pending.add(p);
    } catch {
      /* ignore non-JSON line */
    }
  }
});
// On stdin close, drain any in-flight async tool calls before exiting (don't truncate responses).
process.stdin.on("end", () => {
  Promise.allSettled([...pending]).then(() => process.exit(0));
});
