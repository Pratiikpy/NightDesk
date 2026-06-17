// `npm run demo` — a guided, ~60-second walk through the whole NightDesk loop, with narration
// between steps so a judge understands the system without reading anything. It reuses the real
// commands (no special-case demo logic): the live causality board, a graded autonomous night, and
// independent ledger verification.
import { join } from "node:path";
import { printEventBoard } from "./perception/board";
import { simulate } from "./orchestrator/simulate";
import { printLedgerVerification } from "./ledger/verify";

const line = (s = ""): void => console.log(s);
const rule = (): void => console.log("─".repeat(74));
const pause = (ms = 600): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function runDemo(): Promise<void> {
  rule();
  line("NightDesk — 60-second guided demo");
  line("The autonomous fair-value & risk desk for Bitget tokenized US stocks.");
  rule();
  line();
  line("THE PROBLEM");
  line("  Tokenized US stocks trade 24/7, but the NYSE does not. Off-hours their price drifts —");
  line("  and the Bitget perp (a composite of the same token issuers) co-moves and HIDES the gap.");
  await pause();
  line();
  rule();
  line("STEP 1 — THE RISK DESK");
  line("  For every token: the true gap vs the real-stock anchor, the perp gap that hides it,");
  line("  the cause, and the action. Watch how many read PERP_ILLUSION (perp ~0, real stock off).");
  rule();
  await printEventBoard();
  await pause();
  line();
  rule();
  line("STEP 2 — ONE AUTONOMOUS NIGHT  (perceive → council → 15 gates → sandbox fill → grade)");
  line("  Replaying a recorded snapshot; the council runs offline + deterministic here.");
  line("  Note it grades trades AND abstentions/blocked trades, and reports calibration honestly.");
  rule();
  await simulate(["data/fixtures/live-demo.jsonl"]);
  await pause();
  line();
  rule();
  line("STEP 3 — PROOF");
  line("  Every decision is Ed25519-signed. Re-verify today's ledger independently:");
  rule();
  const day = new Date().toISOString().slice(0, 10);
  printLedgerVerification(join(process.cwd(), "data", "ledger", `${day}.jsonl`));
  line();
  rule();
  line("THE LOOP: knows the true price, knows WHY a gap exists, knows when NOT to trade, proves every call.");
  line("Explore:  npm run dashboard  ·  npm run backtest  ·  npm run flags  ·  npm run mcp");
  rule();
}
