import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "alpha-factory");

interface AlphaZooEntry {
  alpha_id: string;
  family: string;
  signal_source: string;
  direction: string;
  thesis: string;
  safety_filter: string;
  execution_note: string;
  evidence_hint: string;
}

interface CompareRow {
  strategy_id: string;
  family: string;
  source: string;
  direction: string;
  total_pnl: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number;
  robustness_score: number;
  overfit_verdict: string;
  safety_uplift_note: string;
}

const zoo: AlphaZooEntry[] = [
  {
    alpha_id: "true_gap_fade",
    family: "fair_value",
    signal_source: "equity_gap",
    direction: "fade",
    thesis: "Buy cheap rTokens only when the token trades below the official equity anchor after fees.",
    safety_filter: "certificate must be MISPRICED/LONG_ONLY_FADE and all hard gates must pass",
    execution_note: "rToken-only paper fill; flat by open or signal exit",
    evidence_hint: "candidate-strategies.csv source=equity_gap direction=fade",
  },
  {
    alpha_id: "perp_illusion_fade",
    family: "basis_diagnostic",
    signal_source: "perp_gap",
    direction: "fade",
    thesis: "Fade cases where the perp/rToken relationship reveals an off-hours dislocation hidden from naive equity anchoring.",
    safety_filter: "reject stale anchors, thin books, and sub-fee-floor edge",
    execution_note: "perp is treated as signal source, not mandatory hedge",
    evidence_hint: "current Alpha Factory champion family",
  },
  {
    alpha_id: "liquidity_clean_gap",
    family: "execution_quality",
    signal_source: "equity_gap",
    direction: "fade",
    thesis: "Only trade gaps when the quote/book state can survive fees, spread, and depth checks.",
    safety_filter: "liquidity_score high; slippage_bps less than modeled edge",
    execution_note: "partial/no-fill cases are first-class outcomes",
    evidence_hint: "evidence/fill-model",
  },
  {
    alpha_id: "session_phase_gap",
    family: "session_microstructure",
    signal_source: "equity_gap",
    direction: "fade",
    thesis: "Separate off-hours, pre-open, post-close, weekend, holiday, and RTH stand-down regimes.",
    safety_filter: "NYSE calendar state must permit the claim being tested",
    execution_note: "session tag is part of the run card",
    evidence_hint: "evidence/oos/session-summary.csv",
  },
  {
    alpha_id: "news_aware_abstain",
    family: "event_risk",
    signal_source: "event_card",
    direction: "abstain",
    thesis: "Do not fade fresh company news even if the gap looks statistically attractive.",
    safety_filter: "fresh catalyst forces ABSTAIN",
    execution_note: "non-trade is signed and graded as an agent action",
    evidence_hint: "sample blocked verdicts and perception tests",
  },
  {
    alpha_id: "macro_aware_block",
    family: "event_risk",
    signal_source: "macro_window",
    direction: "block",
    thesis: "High-severity macro windows can make cross-asset gaps non-stationary; block instead of forcing a trade.",
    safety_filter: "macro severity high => no tradeable certificate",
    execution_note: "counterfactual logged under safety alpha",
    evidence_hint: "pnl-casefile/safety-alpha-report.md",
  },
  {
    alpha_id: "tracking_error_filter",
    family: "token_quality",
    signal_source: "token_grade",
    direction: "filter",
    thesis: "Only allow size on tokens whose rToken tracking behavior is reliable enough to support fair-value claims.",
    safety_filter: "A/B grades preferred; C/D capped or blocked",
    execution_note: "quality board constrains notional before execution",
    evidence_hint: "TOKEN_SAFETY_STANDARD.md",
  },
  {
    alpha_id: "tight_book_only",
    family: "execution_quality",
    signal_source: "book_state",
    direction: "filter",
    thesis: "A signal is not tradeable unless spread and available depth leave positive net edge.",
    safety_filter: "empty/one-sided/crossed/stale/wide books rejected",
    execution_note: "depth-aware fill model where available",
    evidence_hint: "fill-model-report.md",
  },
  {
    alpha_id: "high_threshold_only",
    family: "overfit_control",
    signal_source: "equity_gap|perp_gap",
    direction: "fade",
    thesis: "Require larger gaps to reduce churn and avoid sub-fee noise.",
    safety_filter: "Overfit Court rejects fragile thresholds",
    execution_note: "threshold sensitivity is recorded in trial registry",
    evidence_hint: "alpha-factory/rejected-overfit-strategies.csv",
  },
  {
    alpha_id: "weekend_to_monday_gap",
    family: "calendar_regime",
    signal_source: "session_phase",
    direction: "fade",
    thesis: "Weekend gaps are measured separately because equity anchor is stale for longer and Monday open resolves the claim.",
    safety_filter: "stale anchor cannot be tradeable unless the run is explicitly research-only",
    execution_note: "graded in OOS/session study when data exists",
    evidence_hint: "calendar-regression-report.md",
  },
];

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: object[]): void {
  const headers = Object.keys(rows[0] ?? {});
  writeFileSync(join(OUT, file), [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))].join("\n") + "\n");
}

function parseCsv(file: string): Record<string, string>[] {
  if (!existsSync(file)) return [];
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const headers = rows[0]!.split(",");
  return rows.slice(1).map((line) => Object.fromEntries(line.split(",").map((cell, i) => [headers[i] ?? `col${i}`, cell])));
}

function familyFor(row: Record<string, string>): string {
  if (row.source === "perp_gap") return "basis_diagnostic";
  if (Number(row.entry_pct) >= 0.75) return "overfit_control";
  return "fair_value";
}

export function runAlphaZoo(): void {
  mkdirSync(OUT, { recursive: true });
  writeCsv("alpha-zoo-catalog.csv", zoo);
  writeFileSync(
    join(OUT, "alpha-zoo-catalog.md"),
    [
      "# NightDesk Alpha Zoo",
      "",
      "Domain-specific alpha catalogue inspired by Vibe-Trading's Alpha Zoo, but scoped to Bitget tokenized US stocks.",
      "",
      "| Alpha | Family | Thesis | Safety Filter |",
      "|---|---|---|---|",
      ...zoo.map((a) => `| ${a.alpha_id} | ${a.family} | ${a.thesis} | ${a.safety_filter} |`),
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK ALPHA ZOO COMPLETE: ${join(OUT, "alpha-zoo-catalog.csv")}`);
}

export function runAlphaCompare(): void {
  mkdirSync(OUT, { recursive: true });
  const candidates = parseCsv(join(OUT, "candidate-strategies.csv"));
  const rows: CompareRow[] = candidates
    .filter((r) => r.overfit_verdict === "PASS")
    .slice(0, 25)
    .map((r) => ({
      strategy_id: r.config_id ?? "",
      family: familyFor(r),
      source: r.source ?? "",
      direction: r.direction ?? "",
      total_pnl: Number(r.total_pnl ?? 0),
      max_drawdown: Number(r.max_drawdown ?? 0),
      total_trades: Number(r.total_trades ?? 0),
      win_rate: Number(r.win_rate ?? 0),
      robustness_score: Number(r.robustness_score ?? 0),
      overfit_verdict: r.overfit_verdict ?? "",
      safety_uplift_note: "compare against guarded arena and shadow-gateway counterfactuals",
    }));
  writeCsv("strategy-compare.csv", rows);
  writeFileSync(
    join(OUT, "strategy-compare.md"),
    [
      "# Strategy Compare",
      "",
      "Head-to-head comparison of the current Alpha Factory survivors.",
      "",
      "| Rank | Strategy | PnL | Max DD | Trades | Robustness |",
      "|---:|---|---:|---:|---:|---:|",
      ...rows.map((r, i) => `| ${i + 1} | ${r.strategy_id} | ${r.total_pnl.toFixed(4)} | ${r.max_drawdown.toFixed(4)} | ${r.total_trades} | ${r.robustness_score.toFixed(4)} |`),
      "",
    ].join("\n"),
  );
  console.log(`NIGHTDESK ALPHA COMPARE COMPLETE: ${join(OUT, "strategy-compare.csv")}`);
}

if (process.argv[1]?.endsWith("alpha-zoo.ts")) {
  runAlphaZoo();
  runAlphaCompare();
}
