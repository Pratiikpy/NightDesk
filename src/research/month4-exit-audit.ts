import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "alpha-factory");

interface AuditRow { requirement: string; passed: boolean; evidence: string[]; detail: string }

function lines(file: string): string[] {
  return readFileSync(join(process.cwd(), file), "utf8").split(/\r?\n/).filter(Boolean);
}

function json<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), file), "utf8")) as T;
}

function csv(file: string): Record<string, string>[] {
  const records = lines(file);
  const headers = records[0]!.split(",");
  return records.slice(1).map((record) => Object.fromEntries(headers.map((header, index) => [header, record.split(",")[index] ?? ""])));
}

export function runMonth4ExitAudit(): { passed: boolean; rows: AuditRow[] } {
  const manifest = json<{ candidates: number; trials: number; rejected: number; passed: number; freezeId: string; dataCutoff: string; dataManifestHash: string; strategyCodeHash: string; costModelHash: string; configHash: string }>("evidence/alpha-factory/manifest.json");
  const trials = lines("evidence/alpha-factory/trial-registry.jsonl").map((line) => JSON.parse(line) as Record<string, unknown>);
  const strategies = lines("evidence/alpha-factory/strategy-catalog.jsonl").map((line) => JSON.parse(line) as { config_id: string; config_hash: string; strategy: { schema?: string; risk?: { certificateRequired?: boolean; hardGatesRequired?: boolean } } });
  const candidates = csv("evidence/alpha-factory/candidate-strategies.csv");
  const rejected = csv("evidence/alpha-factory/rejected-overfit-strategies.csv");
  const folds = csv("evidence/alpha-factory/walkforward-leaderboard.csv");
  const stability = csv("evidence/alpha-factory/stability-surface.csv");
  const frozen = json<{ schema: string; freezeId: string; dataCutoff: string; dataManifestHash: string; strategyCodeHash: string; costModelHash: string; configHash: string; config: { id: string } }>("evidence/alpha-factory/frozen-champion.json");
  const freezeFile = `evidence/alpha-factory/freezes/${frozen.freezeId}.json`;
  const immutable = existsSync(join(process.cwd(), freezeFile)) ? json<typeof frozen>(freezeFile) : null;
  const registry = json<{ schema: string; champion: { status: string; config_id: string; config_hash: string; freeze_id: string }; challengers: unknown[]; watch: unknown[]; retired: unknown[]; rejected: { count: number } }>("evidence/alpha-factory/champion-registry.json");
  const stats = json<{ nTrials: number; deflatedSharpe: number; deflatedSharpeSignificant: boolean; pbo: { status: string } }>("evidence/alpha-factory/overfit-stats.json");
  const hashPattern = /^[a-f0-9]{64}$/;
  const strategyMap = new Map(strategies.map((strategy) => [strategy.config_id, strategy.config_hash]));

  const rows: AuditRow[] = [
    {
      requirement: "Typed strategy DSL separates economic and risk components",
      passed: strategies.length === manifest.candidates && strategies.every((record) => record.strategy.schema === "nightdesk.strategy.v1" && record.strategy.risk?.certificateRequired && record.strategy.risk.hardGatesRequired && hashPattern.test(record.config_hash)),
      evidence: ["evidence/alpha-factory/strategy-catalog.jsonl", "src/research/strategy-dsl.ts", "test/strategy-dsl.test.ts"],
      detail: `${strategies.length} typed, hard-gated strategy specifications with deterministic hashes.`,
    },
    {
      requirement: "Every trial has complete code/data/config/cost lineage",
      passed: trials.length === manifest.trials && trials.every((trial) => trial.schema_version === "nightdesk.trial.v2" && hashPattern.test(String(trial.config_hash)) && hashPattern.test(String(trial.strategy_code_hash)) && hashPattern.test(String(trial.data_hash)) && hashPattern.test(String(trial.cost_model_hash)) && Number.isFinite(Date.parse(String(trial.data_cutoff))) && strategyMap.get(String(trial.config_id)) === trial.config_hash),
      evidence: ["evidence/alpha-factory/trial-registry.jsonl", "evidence/alpha-factory/manifest.json"],
      detail: `${trials.length} trials trace to strategy, code, dataset, cutoff, feature set, and cost model.`,
    },
    {
      requirement: "Leaderboard and rejected rows trace to configuration hashes",
      passed: candidates.length === manifest.candidates && rejected.length === manifest.rejected && [...candidates, ...rejected].every((row) => hashPattern.test(row.config_hash) && strategyMap.get(row.config_id) === row.config_hash),
      evidence: ["evidence/alpha-factory/candidate-strategies.csv", "evidence/alpha-factory/rejected-overfit-strategies.csv"],
      detail: `${candidates.length} leaderboard rows and ${rejected.length} rejected rows retain lineage.`,
    },
    {
      requirement: "Purged and embargoed folds never select on the test session",
      passed: folds.length >= 3 && folds.every((fold) => fold.no_test_parameter_selection === "true" && !fold.train_recordings.split("|").includes(fold.test_recording) && !fold.purged_recordings.split("|").includes(fold.test_recording) && fold.method.includes("embargo")),
      evidence: ["evidence/alpha-factory/walkforward-leaderboard.csv"],
      detail: `${folds.length} train-only selection folds exclude each test session and adjacent sessions.`,
    },
    {
      requirement: "Multiple-testing penalties and null findings remain explicit",
      passed: stats.nTrials === manifest.candidates && Number.isFinite(stats.deflatedSharpe) && typeof stats.deflatedSharpeSignificant === "boolean" && ["computed", "insufficient_slices"].includes(stats.pbo.status),
      evidence: ["evidence/alpha-factory/overfit-stats.json", "evidence/alpha-factory/overfit-court-stats.md"],
      detail: `DSR=${(stats.deflatedSharpe * 100).toFixed(2)}%, significant=${stats.deflatedSharpeSignificant}, PBO=${stats.pbo.status}.`,
    },
    {
      requirement: "Parameter stability surface is evaluated, not merely proposed",
      passed: stability.length === 27 && stability.every((row) => ["stable", "fragile"].includes(row.status) && Number.isFinite(Number(row.total_pnl)) && Number.isFinite(Number(row.worst_pnl)) && Number.isFinite(Number(row.max_drawdown)) && hashPattern.test(row.child_config_hash)),
      evidence: ["evidence/alpha-factory/stability-surface.csv", "evidence/alpha-factory/mutation-history.jsonl"],
      detail: `${stability.length} local entry/take-profit/stop-loss perturbations evaluated across all sessions.`,
    },
    {
      requirement: "Champion freeze is content-addressed and immutable",
      passed: frozen.schema === "nightdesk.champion-freeze.v2" && frozen.freezeId === manifest.freezeId && immutable != null && JSON.stringify(immutable) === JSON.stringify(frozen) && [frozen.dataManifestHash, frozen.strategyCodeHash, frozen.costModelHash, frozen.configHash].every((hash) => hashPattern.test(hash)) && frozen.dataCutoff === manifest.dataCutoff,
      evidence: ["evidence/alpha-factory/frozen-champion.json", freezeFile],
      detail: `Freeze ${frozen.freezeId} binds champion, data cutoff, data manifest, strategy code, costs, and config.`,
    },
    {
      requirement: "Champion lifecycle registry is explicit and reproducible",
      passed: registry.schema === "nightdesk.champion-registry.v1" && registry.champion.status === "champion" && registry.champion.config_id === frozen.config.id && registry.champion.config_hash === frozen.configHash && registry.champion.freeze_id === frozen.freezeId && registry.challengers.length >= 1 && registry.watch.length >= 1 && registry.rejected.count === manifest.rejected,
      evidence: ["evidence/alpha-factory/champion-registry.json", "evidence/alpha-factory/frozen-champion.json"],
      detail: `Champion, ${registry.challengers.length} challengers, ${registry.watch.length} watch candidates, retired history, and rejected population are recorded.`,
    },
  ];
  const passed = rows.every((row) => row.passed);
  const payload = { milestone: "Month 4: Alpha Factory v2", generatedAt: new Date().toISOString(), passed, rows };
  writeFileSync(join(OUT, "month4-exit-audit.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(join(OUT, "month4-exit-audit.md"), [
    "# Month 4 Exit Audit",
    "",
    `Overall: **${passed ? "PASS" : "FAIL"}** (${rows.filter((row) => row.passed).length}/${rows.length})`,
    "",
    "| Requirement | Result | Detail |",
    "|---|---:|---|",
    ...rows.map((row) => `| ${row.requirement} | ${row.passed ? "PASS" : "FAIL"} | ${row.detail} |`),
  ].join("\n") + "\n");
  console.log(`NIGHTDESK MONTH 4 EXIT AUDIT: ${passed ? "PASS" : "FAIL"} (${rows.filter((row) => row.passed).length}/${rows.length})`);
  if (!passed) process.exitCode = 1;
  return { passed, rows };
}

if (process.argv[1]?.endsWith("month4-exit-audit.ts")) runMonth4ExitAudit();
