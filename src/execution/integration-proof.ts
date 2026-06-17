import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSnapshots } from "../bitsim/market";
import { certifyToken } from "../research/certify";
import { issueCertificate, type NightDeskCertificate } from "../kernel/certificate";
import { evaluateIntent } from "../kernel/firewall";
import type { PerceptionContext } from "../perception/events";

const OUT = join(process.cwd(), "evidence", "integration");

const noEvents = (ticker: string): PerceptionContext => ({
  ticker,
  macro: { active: false, date: "", events: [], severity: "low", summary: "" },
  news: { fresh: false, count: 0, relevantCount: 0, matched: [], latestTitle: null, summary: "" },
  severity: "none",
  abstainRecommended: false,
  summary: "external integration proof fixture",
});

export function runIntegrationProof(): void {
  const snap = loadSnapshots("data/snapshots/2026-06-15.jsonl").reverse().find((s) => s.rows.length > 5) ?? loadSnapshots("data/fixtures/live-demo.jsonl")[0]!;
  const rows = snap.rows.slice(0, 5).map((row) => {
    const cert = issueCertificate(certifyToken(row, noEvents(row.ticker)), {
      anchorSource: row.equity == null ? "NONE" : row.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
      anchorStale: row.equity == null,
      now: snap.ts,
      ttlSec: 3600,
    });
    const requested = { ticker: row.ticker, side: (row.premiumVsEquityPct ?? 0) < 0 ? "buy" as const : "sell" as const, sizeUsd: 50 };
    const verdict = evaluateIntent({ ...requested, certificate: cert }, snap.ts);
    return { timestamp: snap.isoTime, tool: "evaluate_intent", surface: "sdk/mcp-compatible", request: requested, response: verdict, certificate: cert.payload };
  });
  const baseRow = snap.rows.find((r) => r.equity && r.rToken?.mid) ?? snap.rows[0]!;
  const goodCert = issueCertificate(certifyToken(baseRow, noEvents(baseRow.ticker)), {
    anchorSource: baseRow.equity == null ? "NONE" : baseRow.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
    anchorStale: baseRow.equity == null,
    now: snap.ts,
    ttlSec: 3600,
  });
  const tamperedCert: NightDeskCertificate = { ...goodCert, payload: { ...goodCert.payload, ticker: "TAMPERED" } };
  const staleCert = issueCertificate(certifyToken(baseRow, noEvents(baseRow.ticker)), {
    anchorSource: "LAST_CLOSE",
    anchorStale: true,
    now: snap.ts - 7_200_000,
    ttlSec: 1,
  });
  const longOnlyCert = issueCertificate({ ...certifyToken(baseRow, noEvents(baseRow.ticker)), policy: "LONG-ONLY FADE", safetyScore: 90 }, {
    anchorSource: baseRow.equity == null ? "NONE" : baseRow.equity.marketState === "REGULAR" ? "NYSE_LIVE" : "LAST_CLOSE",
    anchorStale: false,
    now: snap.ts,
    ttlSec: 3600,
  });
  const abuseCases = [
    { case_id: "no_certificate", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50 }, cert: undefined },
    { case_id: "expired_certificate", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50 }, cert: staleCert, now: snap.ts },
    { case_id: "wrong_ticker_certificate", request: { ticker: `${baseRow.ticker}_WRONG`, side: "buy" as const, sizeUsd: 50 }, cert: goodCert },
    { case_id: "tampered_certificate", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50 }, cert: tamperedCert },
    { case_id: "oversized_notional", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 1_000_000 }, cert: goodCert, expected: "ALLOW_CAPPED" as const },
    { case_id: "side_not_allowed", request: { ticker: baseRow.ticker, side: "sell" as const, sizeUsd: 50 }, cert: longOnlyCert },
    { case_id: "replayed_old_certificate", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50 }, cert: goodCert, now: Date.parse(goodCert.payload.expiresAt) + 1 },
    { case_id: "stale_snapshot_certificate", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50 }, cert: staleCert },
    { case_id: "skip_firewall_attempt", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50, adapter: "direct_execution" }, cert: undefined },
    { case_id: "direct_execution_adapter_attempt", request: { ticker: baseRow.ticker, side: "buy" as const, sizeUsd: 50, adapter: "bitsim_submit_order" }, cert: undefined },
  ].map((c) => {
    const expected = c.expected ?? "REJECT";
    const response = evaluateIntent({ ...c.request, certificate: c.cert }, c.now ?? snap.ts);
    return {
      timestamp: snap.isoTime,
      tool: "evaluate_intent",
      case_id: c.case_id,
      expected,
      request: c.request,
      response,
      pass: response.verdict === expected && (response.verdict !== "ALLOW_CAPPED" || Number(response.cappedSizeUsd) <= Number(c.cert?.payload.maxSizeUsd)),
    };
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "external-agent-run.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(OUT, "malicious-agent-rejections.jsonl"), abuseCases.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(OUT, "abuse-report.md"), [
    "# External-Agent Abuse Report",
    "",
    `Cases: ${abuseCases.length}`,
    `Passed: ${abuseCases.filter((c) => c.pass).length}/${abuseCases.length}`,
    "",
    "Abuse cases include no certificate, expired certificate, wrong ticker, tampered certificate, oversized notional, wrong side, replayed certificate, stale snapshot certificate, firewall bypass attempt, and direct execution adapter attempt.",
    "",
  ].join("\n"));
  writeFileSync(join(OUT, "sdk-example-output.json"), JSON.stringify(rows[0], null, 2) + "\n");
  writeFileSync(join(OUT, "mcp-tool-call-log.jsonl"), rows.map((r, i) => JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "tools/call", params: { name: "evaluate_intent", arguments: r.request }, result: r.response })).join("\n") + "\n");
  writeFileSync(join(OUT, "sample-input.json"), JSON.stringify(rows[0]?.request ?? {}, null, 2) + "\n");
  writeFileSync(join(OUT, "sample-output.json"), JSON.stringify(rows[0]?.response ?? {}, null, 2) + "\n");
  console.log("\nNIGHTDESK INTEGRATION PROOF COMPLETE");
  console.log(`calls: ${rows.length}`);
  console.log(`log: ${join(OUT, "external-agent-run.jsonl")}`);
}

if (process.argv[1]?.endsWith("integration-proof.ts")) runIntegrationProof();
