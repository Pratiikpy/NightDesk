import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ArtifactCheck {
  name: string;
  ok: boolean;
  detail: string;
}

const root = () => process.cwd();

function read(file: string): string {
  return readFileSync(join(root(), file), "utf8");
}

function lines(file: string): string[] {
  return read(file).split(/\r?\n/).filter(Boolean);
}

function parseCsv(file: string): Record<string, string>[] {
  const rows = lines(file);
  if (!rows.length) return [];
  const headers = rows[0]!.split(",");
  return rows.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function finite(v: string): boolean {
  return Number.isFinite(Number(v));
}

function jsonl(file: string): unknown[] {
  return lines(file).map((line) => JSON.parse(line));
}

function check(name: string, fn: () => string | true): ArtifactCheck {
  try {
    const r = fn();
    return { name, ok: r === true, detail: r === true ? "ok" : r };
  } catch (e) {
    return { name, ok: false, detail: (e as Error).message };
  }
}

export function verifyEvidenceArtifacts(): ArtifactCheck[] {
  const required = [
    "evidence/trading-log/nightdesk-paper-trading-log.csv",
    "evidence/trading-log/run-events.jsonl",
    "evidence/trading-log/block-reasons.csv",
    "evidence/trading-log/ledger-verification.txt",
    "evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv",
    "evidence/agent-arena-v2/arena-v2-summary.json",
    "evidence/oos/session-summary.csv",
    "evidence/oos/session-bank/session-summary.csv",
    "evidence/oos/session-bank/session-quality-report.md",
    "evidence/oos/session-bank/manifest.json",
    "evidence/walkforward/fold-results.csv",
    "evidence/walkforward/purged-split-report.csv",
    "evidence/walkforward/purged-split-report.md",
    "evidence/fill-model/partial-fill-cases.csv",
    "evidence/fill-model/adverse-selection-cases.csv",
    "evidence/integration/external-agent-run.jsonl",
    "evidence/integration/malicious-agent-rejections.jsonl",
    "evidence/integration/abuse-report.md",
    "evidence/bitget-live/live-market-snapshot.json",
    "evidence/pnl-casefile/00-executive-summary.md",
    "evidence/pnl-casefile/02-guarded-vs-unguarded.csv",
    "evidence/pnl-casefile/03-pnl-attribution.csv",
    "evidence/pnl-casefile/perp-leg-autopsy.md",
    "evidence/pnl-casefile/safety-alpha-report.md",
    "evidence/pnl-casefile/tradeability-bridge.md",
    "evidence/pnl-casefile/manifest.json",
    "evidence/alpha-championship/alpha-championship-report.md",
    "evidence/alpha-championship/aggregate-leaderboard.csv",
    "evidence/alpha-championship/champion-config.json",
    "evidence/alpha-championship/champion-paper-trading-log.csv",
    "evidence/alpha-championship/global-champion-config.json",
    "evidence/alpha-championship/global-champion-paper-trading-log.csv",
    "evidence/alpha-championship/global-champion-session-results.csv",
    "evidence/alpha-championship/leaderboard.csv",
    "evidence/alpha-championship/session-best.csv",
    "evidence/alpha-championship/manifest.json",
    "evidence/alpha-factory/candidate-strategies.csv",
    "evidence/alpha-factory/trial-registry.jsonl",
    "evidence/alpha-factory/rejected-overfit-strategies.csv",
    "evidence/alpha-factory/overfit-court-report.md",
    "evidence/alpha-factory/walkforward-leaderboard.csv",
    "evidence/alpha-factory/frozen-champion.json",
    "evidence/alpha-factory/champion-oos-results.csv",
    "evidence/alpha-factory/live-paper-trading-log.csv",
    "evidence/alpha-factory/expected-vs-actual.csv",
    "evidence/alpha-factory/daily-alpha-report.md",
    "evidence/alpha-factory/mutation-history.jsonl",
    "evidence/alpha-factory/agent-decisions.jsonl",
    "evidence/alpha-factory/masked-eval-report.md",
    "evidence/alpha-factory/agent-benchmark-standard.md",
    "evidence/alpha-factory/bench-results.csv",
    "evidence/alpha-factory/agent-scorecards.md",
    "evidence/alpha-factory/manifest.json",
    "evidence/alpha-factory/alpha-zoo-catalog.csv",
    "evidence/alpha-factory/alpha-zoo-catalog.md",
    "evidence/alpha-factory/strategy-compare.csv",
    "evidence/alpha-factory/strategy-compare.md",
    "evidence/shadow-gateway/actual-vs-guarded.csv",
    "evidence/shadow-gateway/missed-profit.csv",
    "evidence/shadow-gateway/blocked-loss.csv",
    "evidence/shadow-gateway/rule-breaks.md",
    "evidence/shadow-gateway/counterfactual-trades.jsonl",
    "evidence/claims/claims-manifest.json",
    "evidence/claims/claims-report.md",
    "evidence/run-cards/manifest.json",
    "evidence/run-cards/paper-session-card.md",
    "evidence/run-cards/alpha-factory-card.md",
    "evidence/run-cards/alpha-championship-card.md",
    "evidence/run-cards/guarded-replay-card.md",
    "evidence/run-cards/bitget-smoke-card.md",
    "evidence/run-cards/judge-max-card.md",
    "evidence/doctor-report.md",
    "evidence/doctor-report.json",
    "evidence/docs-check.json",
    "evidence/secrets-scan.json",
    "evidence/data-health/source-health.json",
    "evidence/data-health/source-health.md",
    "evidence/judge-cockpit/index.html",
    "evidence/forward-paper-daemon/session-results.csv",
    "evidence/forward-paper-daemon/live-paper-trading-log.csv",
    "evidence/forward-paper-daemon/daemon-state.json",
    "evidence/forward-paper-daemon/forward-paper-daemon-report.md",
    "evidence/daily-promoter/promotion-decision.json",
    "evidence/daily-promoter/daily-promoter-report.md",
    "evidence/security/security-boundaries.md",
    "evidence/security/security-boundaries.json",
    "evidence/bitget-live/agent-hub-compat-report.md",
    "evidence/bitget-live/agent-hub-compat-report.json",
    "evidence/data-cache/cache-integrity-report.md",
    "evidence/data-cache/cache-integrity-report.json",
    "evidence/oos-daemon/state.json",
    "evidence/oos-daemon/record-log.jsonl",
    "evidence/oos-daemon/refresh-log.jsonl",
    "evidence/live-receipt/order-preview.json",
    "evidence/live-receipt/firewall-verdict.json",
    "evidence/live-receipt/execution-receipt.json",
    "evidence/live-receipt/ledger-verify.txt",
    "evidence/live-receipt/live-receipt-report.md",
    "evidence/championship/leaderboard_pnl.csv",
    "evidence/championship/leaderboard_safety.csv",
    "evidence/championship/champion-pnl.json",
    "evidence/championship/champion-safety.json",
    "evidence/championship/champion-pnl-paper-log.csv",
    "evidence/championship/champion-safety-paper-log.csv",
    "evidence/championship/championship-report.md",
    "evidence/championship/pnl-vs-safety-comparison.md",
    "evidence/championship/champion-overfit-check.md",
    "evidence/championship/champion-overfit-card.md",
    "evidence/championship/trial-registry.csv",
    "evidence/championship/manifest.json",
    "evidence/manifest.json",
    "docs/PNL_CLAIM_STANDARD.md",
    "docs/EXECUTION_INTEGRITY.md",
    "docs/SECURITY_BOUNDARIES.md",
    "docs/BITGET_NATIVE_PROOF.md",
    "docs/CLAIM_LEDGER.md",
    "evidence/max-judge-manifest.json",
  ];
  const checks: ArtifactCheck[] = [];

  checks.push(check("required files exist", () => {
    const missing = required.filter((f) => !existsSync(join(root(), f)));
    return missing.length ? `missing: ${missing.join(", ")}` : true;
  }));

  checks.push(check("paper trading log schema and rows", () => {
    const rows = parseCsv("evidence/trading-log/nightdesk-paper-trading-log.csv");
    const requiredHeaders = ["timestamp", "asset", "direction", "price", "quantity", "balance_before", "balance_after", "balance_change", "certificate_id", "firewall_verdict", "ledger_hash", "fill_model", "liquidity_score", "slippage_bps", "order_denied_reason"];
    const headers = Object.keys(rows[0] ?? {});
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length) return `missing columns: ${missing.join(", ")}`;
    if (rows.length < 10) return `too few paper rows: ${rows.length}`;
    const fills = rows.filter((r) => r.direction !== "BLOCK");
    const blocks = rows.filter((r) => r.direction === "BLOCK");
    if (!fills.length) return "no executed paper fills";
    if (!blocks.length) return "no blocked paper intents";
    for (const r of rows) {
      if (!Date.parse(r.timestamp ?? "")) return `bad timestamp for ${r.asset}`;
      if (!/^[a-f0-9]{64}$/.test(r.ledger_hash ?? "")) return `bad ledger hash for ${r.asset}`;
      if (!finite(r.balance_before ?? "") || !finite(r.balance_after ?? "") || !finite(r.balance_change ?? "")) return `bad balances for ${r.asset}`;
      const delta = Number(r.balance_after) - Number(r.balance_before);
      if (Math.abs(delta - Number(r.balance_change)) > 1e-4) return `balance delta mismatch for ${r.asset}`;
      if (r.direction === "BLOCK" && !(r.order_denied_reason ?? "")) return `blocked row lacks denial code for ${r.asset}`;
      if (r.direction !== "BLOCK" && !(r.fill_model ?? "")) return `fill row lacks fill model for ${r.asset}`;
    }
    return true;
  }));

  checks.push(check("run event topics include full execution path", () => {
    const events = jsonl("evidence/trading-log/run-events.jsonl") as { topic?: string; type?: string }[];
    const topics = new Set(events.map((e) => e.topic).filter(Boolean));
    const requiredTopics = ["data.snapshot", "cert.issued", "intent.submitted", "firewall.verdict", "risk.denied", "order.submitted", "order.filled", "ledger.signed", "component.state"];
    const missing = requiredTopics.filter((t) => !topics.has(t));
    return missing.length ? `missing topics: ${missing.join(", ")}` : true;
  }));

  checks.push(check("guarded replay is positive and labeled", () => {
    const summary = read("evidence/trading-log/guarded-replay/run-summary.md");
    if (!/Execution evidence, not an out-of-sample alpha claim/i.test(summary)) return "missing honest alpha caveat";
    const match = summary.match(/Net paper PnL:\s*([-0-9.]+)/);
    if (!match || Number(match[1]) <= 0) return "guarded replay net PnL not positive";
    return true;
  }));

  checks.push(check("fill realism all cases pass", () => {
    const rows = parseCsv("evidence/fill-model/partial-fill-cases.csv");
    if (rows.length < 7) return `too few fill cases: ${rows.length}`;
    const failed = rows.filter((r) => r.status !== "pass").map((r) => r.case_id);
    if (failed.length) return `failed cases: ${failed.join(", ")}`;
    const adverse = parseCsv("evidence/fill-model/adverse-selection-cases.csv");
    if (adverse.length < 2) return `too few adverse-selection cases: ${adverse.length}`;
    const adverseFailed = adverse.filter((r) => r.status !== "pass").map((r) => r.case_id);
    return adverseFailed.length ? `failed adverse-selection cases: ${adverseFailed.join(", ")}` : true;
  }));

  checks.push(check("OOS and walk-forward reports are non-empty and session-backed", () => {
    const oos = parseCsv("evidence/oos/session-summary.csv");
    const bank = parseCsv("evidence/oos/session-bank/session-summary.csv");
    const folds = parseCsv("evidence/walkforward/fold-results.csv");
    const purged = parseCsv("evidence/walkforward/purged-split-report.csv");
    if (oos.length < 1) return "no OOS sessions";
    if (bank.length !== oos.length) return `session bank mismatch ${bank.length}/${oos.length}`;
    if (folds.length !== oos.length) return `fold/session mismatch ${folds.length}/${oos.length}`;
    if (purged.length !== folds.length) return `purged/fold mismatch ${purged.length}/${folds.length}`;
    if (!purged.every((r) => r.no_test_threshold_selection === "true")) return "purged report allows test-fold threshold selection";
    if (!oos.every((r) => r.ledger_hash && /^[a-f0-9]{64}$/.test(r.ledger_hash))) return "bad OOS ledger hash";
    const quality = read("evidence/oos/session-bank/session-quality-report.md");
    if (!/OOS daemon appends future sessions/i.test(quality)) return "session bank lacks future-session boundary";
    return true;
  }));

  checks.push(check("integration proof is SDK/MCP-shaped", () => {
    const calls = jsonl("evidence/integration/external-agent-run.jsonl") as { tool?: string; request?: unknown; response?: { verdict?: string } }[];
    if (calls.length < 3) return `too few integration calls: ${calls.length}`;
    if (!calls.every((c) => c.tool === "evaluate_intent" && c.request && c.response?.verdict)) return "bad integration call shape";
    const mcp = jsonl("evidence/integration/mcp-tool-call-log.jsonl") as { method?: string; params?: { name?: string } }[];
    if (!mcp.every((c) => c.method === "tools/call" && c.params?.name === "evaluate_intent")) return "bad MCP call log shape";
    const malicious = jsonl("evidence/integration/malicious-agent-rejections.jsonl") as { case_id?: string; expected?: string; response?: { verdict?: string; cappedSizeUsd?: number }; pass?: boolean }[];
    if (malicious.length < 10) return `too few malicious-agent abuse cases: ${malicious.length}`;
    if (!malicious.every((c) => c.response?.verdict === c.expected && c.pass === true)) return "malicious-agent abuse case did not match expected verdict";
    if (!malicious.some((c) => c.case_id === "oversized_notional" && c.expected === "ALLOW_CAPPED" && Number.isFinite(Number(c.response?.cappedSizeUsd)))) return "oversized notional did not prove capped execution";
    const unsafe = malicious.filter((c) => c.case_id !== "oversized_notional");
    if (!unsafe.every((c) => c.expected === "REJECT" && c.response?.verdict === "REJECT")) return "unsafe malicious-agent case was not rejected";
    return true;
  }));

  checks.push(check("Bitget live proof is read-only and secret-free", () => {
    const proof = read("evidence/bitget-live/read-only-proof.md");
    const snapshot = JSON.parse(read("evidence/bitget-live/live-market-snapshot.json")) as Record<string, unknown>;
    if (!/read-only default/i.test(proof)) return "read-only posture missing";
    const text = JSON.stringify(snapshot);
    if (/secret|passphrase|api[_-]?key/i.test(text)) return "snapshot appears to contain secret material";
    if (!("symbol" in snapshot)) return "snapshot lacks symbol";
    return true;
  }));

  checks.push(check("PnL casefile exists and states claim boundaries", () => {
    const summary = read("evidence/pnl-casefile/00-executive-summary.md");
    const delta = parseCsv("evidence/pnl-casefile/02-guarded-vs-unguarded.csv");
    if (!/does not claim guaranteed alpha/i.test(summary)) return "missing alpha-boundary language";
    if (!/highest raw PnL/i.test(summary)) return "missing raw-PnL boundary language";
    if (delta.length < 3) return `too few guarded/unguarded comparisons: ${delta.length}`;
    const manifest = JSON.parse(read("evidence/pnl-casefile/manifest.json")) as { manifest: { exists: boolean }[] };
    if (!manifest.manifest.every((m) => m.exists)) return "pnl casefile manifest contains missing files";
    return true;
  }));

  checks.push(check("raw-PnL alpha championship is profitable and caveated", () => {
    const report = read("evidence/alpha-championship/alpha-championship-report.md");
    if (!/in-sample research evidence/i.test(report)) return "missing in-sample caveat";
    if (!/not a production alpha guarantee/i.test(report)) return "missing production-alpha caveat";
    const manifest = JSON.parse(read("evidence/alpha-championship/manifest.json")) as {
      champion?: { netPnl?: number; trades?: number } | null;
      globalChampion?: { totalPnl?: number; totalTrades?: number; sessions?: number } | null;
    };
    if (!manifest.champion) return "missing single-session champion";
    if (!manifest.globalChampion) return "missing global champion";
    if (!Number.isFinite(manifest.champion.netPnl) || Number(manifest.champion.netPnl) <= 0) return "champion net PnL is not positive";
    if (!Number.isFinite(manifest.champion.trades) || Number(manifest.champion.trades) <= 0) return "champion has no trades";
    if (!Number.isFinite(manifest.globalChampion.totalPnl) || Number(manifest.globalChampion.totalPnl) <= 0) return "global champion total PnL is not positive";
    if (!Number.isFinite(manifest.globalChampion.totalTrades) || Number(manifest.globalChampion.totalTrades) <= 0) return "global champion has no trades";
    const rows = parseCsv("evidence/alpha-championship/champion-paper-trading-log.csv");
    if (rows.length < 2) return "champion paper log too small";
    const globalRows = parseCsv("evidence/alpha-championship/global-champion-paper-trading-log.csv");
    // The global champion (best total PnL across all recordings) and the single-session champion are
    // different configs, so the global log can legitimately have fewer rows — only require it to be
    // substantive, not >= the single-session log (that invariant was data-luck, not a real guarantee).
    if (globalRows.length < 2) return "global champion paper log too small";
    const requiredHeaders = ["timestamp", "asset", "direction", "price", "quantity", "balance_change", "ledger_hash"];
    const headers = Object.keys(rows[0] ?? {});
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    return missing.length ? `champion paper log missing columns: ${missing.join(", ")}` : true;
  }));

  checks.push(check("alpha factory records trials, rejects overfit, and freezes champion", () => {
    const manifest = JSON.parse(read("evidence/alpha-factory/manifest.json")) as {
      candidates?: number;
      trials?: number;
      rejected?: number;
      frozenChampion?: { id?: string };
      championSelection?: { total_pnl?: number; total_trades?: number };
    };
    if (!manifest.candidates || manifest.candidates < 100) return "too few alpha candidates";
    if (!manifest.trials || manifest.trials < manifest.candidates) return "trial registry too small";
    if (!manifest.rejected || manifest.rejected < 1) return "overfit court rejected nothing";
    if (!manifest.frozenChampion?.id) return "missing frozen champion";
    if (!Number.isFinite(manifest.championSelection?.total_pnl)) return "missing champion total PnL";
    const decisions = jsonl("evidence/alpha-factory/agent-decisions.jsonl") as { agent?: string; decision?: string }[];
    const requiredAgents = ["AlphaResearchAgent", "OverfitCourt", "ChampionFreezer", "StrategyMutator"];
    const missingAgents = requiredAgents.filter((agent) => !decisions.some((d) => d.agent === agent));
    if (missingAgents.length) return `missing agent decisions: ${missingAgents.join(", ")}`;
    const oos = parseCsv("evidence/alpha-factory/champion-oos-results.csv");
    if (!oos.length) return "missing champion OOS rows";
    const wf = parseCsv("evidence/alpha-factory/walkforward-leaderboard.csv");
    if (!wf.length) return "missing walk-forward rows";
    const liveLog = parseCsv("evidence/alpha-factory/live-paper-trading-log.csv");
    if (!liveLog.length) return "missing frozen champion paper log rows";
    const masked = read("evidence/alpha-factory/masked-eval-report.md");
    if (!/ticker names, company names/i.test(masked)) return "masked eval does not state masked fields";
    const bench = parseCsv("evidence/alpha-factory/bench-results.csv");
    if (bench.length < 5 || !bench.every((r) => r.status === "pass")) return "benchmark results incomplete";
    return true;
  }));

  checks.push(check("alpha zoo and compare exist", () => {
    const zoo = parseCsv("evidence/alpha-factory/alpha-zoo-catalog.csv");
    if (zoo.length < 10) return `too few alpha zoo entries: ${zoo.length}`;
    const compare = parseCsv("evidence/alpha-factory/strategy-compare.csv");
    if (compare.length < 5) return `too few strategy compare rows: ${compare.length}`;
    if (!compare.every((r) => finite(r.total_pnl ?? "") && finite(r.robustness_score ?? ""))) return "strategy compare has non-finite metrics";
    return true;
  }));

  checks.push(check("shadow gateway counterfactuals exist", () => {
    const rows = parseCsv("evidence/shadow-gateway/actual-vs-guarded.csv");
    if (rows.length < 3) return `too few shadow rows: ${rows.length}`;
    const events = jsonl("evidence/shadow-gateway/counterfactual-trades.jsonl") as { type?: string }[];
    if (events.length !== rows.length) return `shadow jsonl/csv mismatch ${events.length}/${rows.length}`;
    if (!events.every((e) => e.type === "SHADOW_COUNTERFACTUAL")) return "bad shadow event type";
    return true;
  }));

  checks.push(check("claim ledger verifies major claims", () => {
    const manifest = JSON.parse(read("evidence/claims/claims-manifest.json")) as { claims: { id: string; status: string }[] };
    const requiredClaims = ["paper_trading_record", "alpha_factory", "raw_pnl_championship", "safety_gateway", "bitget_native", "shadow_gateway"];
    const missing = requiredClaims.filter((id) => !manifest.claims.some((c) => c.id === id));
    if (missing.length) return `missing claims: ${missing.join(", ")}`;
    const weak = manifest.claims.filter((c) => c.status === "blocked").map((c) => c.id);
    return weak.length ? `blocked claims: ${weak.join(", ")}` : true;
  }));

  checks.push(check("run cards, doctor, data health, and cockpit exist", () => {
    const cards = JSON.parse(read("evidence/run-cards/manifest.json")) as { cards: string[] };
    if (cards.cards.length < 6) return `too few run cards: ${cards.cards.length}`;
    const doctor = JSON.parse(read("evidence/doctor-report.json")) as { rows: { status: string }[] };
    if (!doctor.rows.length) return "doctor has no rows";
    if (doctor.rows.some((r) => r.status === "fail")) return "doctor has failing rows";
    const data = JSON.parse(read("evidence/data-health/source-health.json")) as { rows: { status: string }[] };
    if (!data.rows.length) return "data health has no rows";
    const docs = JSON.parse(read("evidence/docs-check.json")) as { ok?: boolean; missing?: string[] };
    if (!docs.ok) return `docs check failed: ${(docs.missing ?? []).join(", ")}`;
    const secrets = JSON.parse(read("evidence/secrets-scan.json")) as { ok?: boolean; findings?: unknown[] };
    if (!secrets.ok) return `secrets scan findings: ${(secrets.findings ?? []).length}`;
    const cockpit = read("evidence/judge-cockpit/index.html");
    if (!/Judge Cockpit/.test(cockpit)) return "judge cockpit missing title";
    return true;
  }));

  checks.push(check("forward paper daemon and daily promoter exist", () => {
    const state = JSON.parse(read("evidence/forward-paper-daemon/daemon-state.json")) as { championId?: string; sessions?: number; ledgerHash?: string };
    if (!state.championId) return "daemon missing champion id";
    if (!state.sessions || state.sessions < 1) return "daemon has no sessions";
    if (!/^[a-f0-9]{64}$/.test(state.ledgerHash ?? "")) return "bad daemon ledger hash";
    const sessions = parseCsv("evidence/forward-paper-daemon/session-results.csv");
    if (sessions.length !== state.sessions) return `daemon session mismatch ${sessions.length}/${state.sessions}`;
    const promoter = JSON.parse(read("evidence/daily-promoter/promotion-decision.json")) as { decision?: string; championId?: string };
    if (!["KEEP", "WATCH", "RETIRE"].includes(promoter.decision ?? "")) return "bad promoter decision";
    if (promoter.championId !== state.championId) return "promoter/daemon champion mismatch";
    return true;
  }));

  checks.push(check("security, Bitget compat, and cache integrity evidence exist", () => {
    const security = JSON.parse(read("evidence/security/security-boundaries.json")) as { rows: { boundary: string; allowed: boolean; reason: string }[] };
    const liveDefault = security.rows.find((r) => r.boundary === "live_default");
    if (!liveDefault || liveDefault.allowed || liveDefault.reason !== "LIVE_TRADE_DISABLED") return "live default boundary is not fail-closed";
    const compat = JSON.parse(read("evidence/bitget-live/agent-hub-compat-report.json")) as { rows: { capability: string; status: string }[] };
    if (!compat.rows.some((r) => r.capability === "mcp_evaluate_intent" && r.status === "verified")) return "Bitget compat lacks MCP proof";
    const cache = JSON.parse(read("evidence/data-cache/cache-integrity-report.json")) as { rows: unknown[] };
    if (!Array.isArray(cache.rows)) return "bad cache report";
    return true;
  }));

  checks.push(check("OOS background daemon and live receipt proof exist", () => {
    const state = JSON.parse(read("evidence/oos-daemon/state.json")) as { status?: string; ticks?: number; refreshes?: number; snapshotsRecorded?: number };
    if (!["running", "stopped", "once_complete"].includes(state.status ?? "")) return `bad OOS daemon status: ${state.status}`;
    if (!state.ticks || state.ticks < 1) return "OOS daemon did not record a tick";
    if (!state.refreshes || state.refreshes < 1) return "OOS daemon did not refresh evidence";
    if (!state.snapshotsRecorded || state.snapshotsRecorded < 1) return "OOS daemon did not record snapshots";
    const recordRows = jsonl("evidence/oos-daemon/record-log.jsonl") as { file?: string; tokens?: number }[];
    if (!recordRows.length || !recordRows.every((r) => r.file && Number(r.tokens) > 0)) return "bad OOS record log";
    const refreshRows = jsonl("evidence/oos-daemon/refresh-log.jsonl") as { sessions?: number }[];
    if (!refreshRows.length) return "bad OOS refresh log";
    const preview = JSON.parse(read("evidence/live-receipt/order-preview.json")) as { boundary?: { reason?: string }; willSubmitOrder?: boolean };
    const receipt = JSON.parse(read("evidence/live-receipt/execution-receipt.json")) as { submitted?: boolean; ledgerHash?: string };
    if (!preview.boundary?.reason) return "live receipt lacks boundary reason";
    if (receipt.submitted !== false) return "live receipt must not claim a real exchange fill";
    if (!/^[a-f0-9]{64}$/.test(receipt.ledgerHash ?? "")) return "bad live receipt ledger hash";
    return true;
  }));

  checks.push(check("championship mode freezes separate PnL and safety champions", () => {
    const pnlBoard = parseCsv("evidence/championship/leaderboard_pnl.csv");
    const safetyBoard = parseCsv("evidence/championship/leaderboard_safety.csv");
    if (pnlBoard.length < 10 || safetyBoard.length < 10) return "championship leaderboards too small";
    const pnlChampion = JSON.parse(read("evidence/championship/champion-pnl.json")) as { objective?: string; metrics?: { net_pnl?: number; score_pnl?: number; overfit_status?: string }; hard_safety_invariants?: Record<string, boolean> };
    const safetyChampion = JSON.parse(read("evidence/championship/champion-safety.json")) as { objective?: string; metrics?: { score_safety?: number; overfit_status?: string }; hard_safety_invariants?: Record<string, boolean> };
    if (pnlChampion.objective !== "pnl") return "bad pnl champion objective";
    if (safetyChampion.objective !== "safety") return "bad safety champion objective";
    if (!Number.isFinite(pnlChampion.metrics?.net_pnl) || Number(pnlChampion.metrics?.net_pnl) <= 0) return "PnL champion is not positive";
    if (!Number.isFinite(pnlChampion.metrics?.score_pnl)) return "PnL champion lacks score";
    if (!Number.isFinite(safetyChampion.metrics?.score_safety)) return "safety champion lacks score";
    const hard = pnlChampion.hard_safety_invariants ?? {};
    const requiredHard = ["staleAnchorBlock", "newsMacroBlock", "issuerRiskBlock", "liquidityTrapBlock", "feeSlippageEdgeCheck"];
    const missingHard = requiredHard.filter((k) => hard[k] !== true);
    if (missingHard.length) return `PnL champion missing hard invariants: ${missingHard.join(", ")}`;
    const pnlLog = parseCsv("evidence/championship/champion-pnl-paper-log.csv");
    const safeLog = parseCsv("evidence/championship/champion-safety-paper-log.csv");
    if (!pnlLog.length || !safeLog.length) return "champion paper logs missing rows";
    const overfit = read("evidence/championship/champion-overfit-check.md");
    if (!/Same-sample green numbers are labeled as championship evidence/i.test(overfit)) return "overfit report lacks caveat";
    const overfitCard = read("evidence/championship/champion-overfit-card.md");
    const requiredPhrases = ["Leave-one-session-out PnL", "Leave-one-token-out PnL", "Cost +20% PnL", "Slippage +20% PnL", "Threshold -10% PnL", "Profit concentration", "Fragility label"];
    const missingPhrases = requiredPhrases.filter((p) => !overfitCard.includes(p));
    if (missingPhrases.length) return `overfit card missing: ${missingPhrases.join(", ")}`;
    const manifest = JSON.parse(read("evidence/championship/manifest.json")) as { candidates?: number; trials?: number };
    if (!manifest.candidates || manifest.candidates < 1000) return "too few championship candidates";
    if (!manifest.trials || manifest.trials < manifest.candidates) return "too few championship trials";
    return true;
  }));

  checks.push(check("max judge manifest covers deep evidence layers", () => {
    const manifest = JSON.parse(read("evidence/max-judge-manifest.json")) as { manifest: { file: string; exists: boolean }[] };
    const publicManifest = JSON.parse(read("evidence/manifest.json")) as { manifest: { file: string; exists: boolean }[] };
    if (!publicManifest.manifest?.length) return "public evidence manifest is empty";
    const files = new Set(manifest.manifest.map((m) => m.file));
    const missing = required.filter((f) => !files.has(f) && f !== "evidence/max-judge-manifest.json");
    if (missing.length) return `manifest missing: ${missing.join(", ")}`;
    if (!manifest.manifest.every((m) => m.exists)) return "manifest contains missing files";
    return true;
  }));

  return checks;
}

export function printEvidenceArtifactVerification(): void {
  const checks = verifyEvidenceArtifacts();
  console.log("\nNightDesk Evidence Artifact Verification\n");
  for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  if (!checks.every((c) => c.ok)) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("verify-artifacts.ts")) printEvidenceArtifactVerification();
