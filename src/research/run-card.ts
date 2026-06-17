import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence", "run-cards");

interface Card {
  file: string;
  title: string;
  command: string;
  inputs: string[];
  outputs: string[];
  claim_supported: string;
  notes: string[];
}

function readJson<T>(path: string): T | null {
  const full = join(process.cwd(), path);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

function existsMark(path: string): string {
  return existsSync(join(process.cwd(), path)) ? "present" : "missing";
}

export function runRunCards(): void {
  mkdirSync(OUT, { recursive: true });
  const alphaFactory = readJson<{ candidates?: number; trials?: number; rejected?: number; championSelection?: { total_pnl?: number; max_drawdown?: number } }>("evidence/alpha-factory/manifest.json");
  const alphaChamp = readJson<{ champion?: { netPnl?: number; trades?: number }; globalChampion?: { totalPnl?: number; totalTrades?: number } }>("evidence/alpha-championship/manifest.json");

  const cards: Card[] = [
    {
      file: "paper-session-card.md",
      title: "Paper Session",
      command: "npm run paper-session",
      inputs: ["config/universe.json", "live/fixture market snapshot"],
      outputs: ["evidence/trading-log/nightdesk-paper-trading-log.csv", "evidence/trading-log/run-summary.md"],
      claim_supported: "Bitget-required paper trading record exists and includes trades, blocks, balances, and ledger hashes.",
      notes: ["Non-trades are first-class actions: TRADE, BLOCK, ABSTAIN."],
    },
    {
      file: "alpha-factory-card.md",
      title: "Alpha Factory",
      command: "npm run alpha:factory",
      inputs: ["data/snapshots/*.jsonl"],
      outputs: ["evidence/alpha-factory/manifest.json", "evidence/alpha-factory/live-paper-trading-log.csv"],
      claim_supported: "Autonomous strategy generation, trial registry, overfit rejection, frozen champion, expected-vs-actual evidence.",
      notes: [`candidates=${alphaFactory?.candidates ?? "n/a"}`, `trials=${alphaFactory?.trials ?? "n/a"}`, `rejected=${alphaFactory?.rejected ?? "n/a"}`, `champion_pnl=${alphaFactory?.championSelection?.total_pnl ?? "n/a"}`],
    },
    {
      file: "alpha-championship-card.md",
      title: "Raw-PnL Alpha Championship",
      command: "npm run alpha:championship",
      inputs: ["data/snapshots/*.jsonl"],
      outputs: ["evidence/alpha-championship/alpha-championship-report.md", "evidence/alpha-championship/champion-paper-trading-log.csv"],
      claim_supported: "NightDesk can compete on raw paper PnL over current recordings with reproducible candidate search.",
      notes: [`single_session_net_pnl=${alphaChamp?.champion?.netPnl ?? "n/a"}`, `global_total_pnl=${alphaChamp?.globalChampion?.totalPnl ?? "n/a"}`],
    },
    {
      file: "guarded-replay-card.md",
      title: "Guarded Replay",
      command: "npm run paper-replay",
      inputs: ["data/snapshots/2026-06-15.jsonl"],
      outputs: ["evidence/trading-log/guarded-replay/guarded-replay-paper-trading-log.csv"],
      claim_supported: "Recorded-day guarded execution can produce positive paper PnL while logging every blocked unsafe/non-executable intent.",
      notes: ["Labeled as execution evidence, not OOS alpha proof."],
    },
    {
      file: "bitget-smoke-card.md",
      title: "Bitget Read-Only Smoke",
      command: "npm run bitget:read-only-proof",
      inputs: ["public Bitget market data"],
      outputs: ["evidence/bitget-live/live-market-snapshot.json", "evidence/bitget-live/read-only-proof.md"],
      claim_supported: "NightDesk can use live Bitget public data without credentials or write permissions.",
      notes: ["No secrets are printed or required."],
    },
    {
      file: "judge-max-card.md",
      title: "Max Judge Verification",
      command: "npm run judge:max",
      inputs: ["tests", "evidence artifacts", "max manifest"],
      outputs: ["evidence/max-judge-manifest.json"],
      claim_supported: "Fast judge path verifies tests, evidence schema, and complete artifact manifest.",
      notes: ["Use npm run judge:max:full to regenerate the full stack end-to-end."],
    },
  ];

  for (const c of cards) {
    writeFileSync(
      join(OUT, c.file),
      [
        `# ${c.title}`,
        "",
        `Run ID: ${c.file.replace(/\.md$/, "")}`,
        `Command: \`${c.command}\``,
        "",
        "## Inputs",
        ...c.inputs.map((i) => `- ${i}`),
        "",
        "## Outputs",
        ...c.outputs.map((o) => `- ${o} (${existsMark(o)})`),
        "",
        "## Claim Supported",
        c.claim_supported,
        "",
        "## Notes",
        ...c.notes.map((n) => `- ${n}`),
        "",
      ].join("\n"),
    );
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), cards: cards.map((c) => c.file) }, null, 2) + "\n",
  );
  console.log(`NIGHTDESK RUN CARDS COMPLETE: ${OUT}`);
}

if (process.argv[1]?.endsWith("run-card.ts")) runRunCards();
