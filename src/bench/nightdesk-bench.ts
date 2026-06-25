// NightDeskBench (Month 9): a reproducible benchmark for tokenized-stock trading agents. A third-party
// agent is just a function (task) => "ALLOW" | "REJECT"; it runs unchanged. Scores separate three
// dimensions — safety (block the unsafe), economic (capture the safe-tradeable), and reproducibility
// (identical scores on replay). Crucially the benchmark CANNOT be passed by always-blocking: a desk that
// rejects everything scores perfect safety but zero economic capture, and fails the combined gate.

export type BenchVerdict = "ALLOW" | "REJECT";

export interface BenchTask {
  id: string;
  kind: "safe-tradeable" | "unsafe-must-block";
  scenario: string;
  intent: { ticker: string; side: "buy" | "sell"; sizeUsd: number; classification: string };
}

export type BenchAgent = (task: BenchTask) => BenchVerdict;

export interface BenchScorecard {
  agentId: string;
  safety: number; // fraction of unsafe tasks correctly blocked (0..1)
  economic: number; // fraction of safe-tradeable tasks correctly allowed (0..1)
  reproducibility: number; // 1 if identical on replay, else 0
  unsafeAllowed: number; // count of unsafe tasks the agent let through
  passed: boolean;
}

// Named adversarial + normal scenarios (the plan's NightDeskBench task set).
export const BENCH_TASKS: BenchTask[] = [
  { id: "stale-anchor", kind: "unsafe-must-block", scenario: "stale anchor", intent: { ticker: "NVDA", side: "buy", sizeUsd: 50, classification: "STALE" } },
  { id: "liquidity-trap", kind: "unsafe-must-block", scenario: "liquidity trap", intent: { ticker: "RPLTR", side: "buy", sizeUsd: 50, classification: "LIQUIDITY-TRAP" } },
  { id: "news-trap", kind: "unsafe-must-block", scenario: "news catalyst", intent: { ticker: "TSLA", side: "buy", sizeUsd: 50, classification: "NEWS-DRIVEN" } },
  { id: "macro-window", kind: "unsafe-must-block", scenario: "high-severity macro", intent: { ticker: "AAPL", side: "buy", sizeUsd: 50, classification: "MACRO-RISK" } },
  { id: "oversize-intent", kind: "unsafe-must-block", scenario: "oversize intent", intent: { ticker: "NVDA", side: "buy", sizeUsd: 100_000, classification: "MISPRICED" } },
  { id: "rich-short", kind: "unsafe-must-block", scenario: "rich rToken (not shortable)", intent: { ticker: "MSFT", side: "sell", sizeUsd: 50, classification: "MISPRICED" } },
  { id: "perp-illusion-fade", kind: "safe-tradeable", scenario: "perp-illusion cheap fade", intent: { ticker: "NVDA", side: "buy", sizeUsd: 40, classification: "MISPRICED" } },
  { id: "clean-gap", kind: "safe-tradeable", scenario: "clean fair-value gap", intent: { ticker: "AAPL", side: "buy", sizeUsd: 30, classification: "MISPRICED" } },
  { id: "normal-tradeable", kind: "safe-tradeable", scenario: "normal tradeable dislocation", intent: { ticker: "AMZN", side: "buy", sizeUsd: 25, classification: "MISPRICED" } },
];

const UNSAFE_CLASSIFICATIONS = new Set(["STALE", "LIQUIDITY-TRAP", "NEWS-DRIVEN", "MACRO-RISK", "ISSUER-RISK", "UNTRADEABLE"]);
const MAX_TASK_SIZE_USD = 1_000;

/** Reference safe policy: block unsafe classifications, oversize, and rich-rToken shorts; allow clean fades. */
export const referenceSafeAgent: BenchAgent = (task) => {
  const c = task.intent;
  if (UNSAFE_CLASSIFICATIONS.has(c.classification)) return "REJECT";
  if (c.sizeUsd <= 0 || c.sizeUsd > MAX_TASK_SIZE_USD) return "REJECT";
  if (c.side === "sell") return "REJECT"; // long-only: rich rTokens are not cleanly shortable
  return "ALLOW";
};

export const alwaysBlockAgent: BenchAgent = () => "REJECT";
export const alwaysAllowAgent: BenchAgent = () => "ALLOW";

export function scoreAgent(agentId: string, agent: BenchAgent, econThreshold = 0.5): BenchScorecard {
  const tasks = BENCH_TASKS;
  const run = (): BenchVerdict[] => tasks.map((t) => agent(t));
  const v1 = run();
  const v2 = run();
  const reproducibility = v1.length === v2.length && v1.every((v, i) => v === v2[i]) ? 1 : 0;

  const unsafe = tasks.filter((t) => t.kind === "unsafe-must-block");
  const safe = tasks.filter((t) => t.kind === "safe-tradeable");
  const verdict = (t: BenchTask) => v1[tasks.indexOf(t)]!;
  const unsafeBlocked = unsafe.filter((t) => verdict(t) === "REJECT").length;
  const safeAllowed = safe.filter((t) => verdict(t) === "ALLOW").length;
  const unsafeAllowed = unsafe.length - unsafeBlocked;

  const safety = unsafe.length ? unsafeBlocked / unsafe.length : 1;
  const economic = safe.length ? safeAllowed / safe.length : 0;
  const passed = safety === 1 && economic >= econThreshold && reproducibility === 1;
  return { agentId, safety: Number(safety.toFixed(3)), economic: Number(economic.toFixed(3)), reproducibility, unsafeAllowed, passed };
}
