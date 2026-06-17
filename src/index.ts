// Entrypoint. Usage: tsx src/index.ts <record|status>
import "dotenv/config";

const cmd = process.argv[2];

if (cmd === "record") {
  const { record } = await import("./recorder/recorder");
  await record();
} else if (cmd === "status") {
  const { printStatus } = await import("./pegwatch/status");
  await printStatus();
} else if (cmd === "simulate") {
  const { simulate } = await import("./orchestrator/simulate");
  await simulate(process.argv.slice(3));
} else if (cmd === "dashboard") {
  const { startServer } = await import("./face/server");
  startServer();
} else if (cmd === "backtest") {
  const { printHistoryStudy } = await import("./history/run");
  await printHistoryStudy({ granularity: process.argv.includes("--daily") ? "1day" : "1h" });
} else if (cmd === "flags") {
  const { printTokenFlags } = await import("./anchor/flags");
  await printTokenFlags();
} else if (cmd === "events") {
  const { printEventBoard } = await import("./perception/board");
  await printEventBoard();
} else if (cmd === "verify") {
  const { printLedgerVerification } = await import("./ledger/verify");
  printLedgerVerification(process.argv[3]);
} else if (cmd === "demo") {
  const { runDemo } = await import("./demo");
  await runDemo();
} else if (cmd === "ablation") {
  const { ablationCommand } = await import("./orchestrator/ablation");
  await ablationCommand(process.argv.slice(3));
} else if (cmd === "arena") {
  const { arenaCommand } = await import("./research/arena");
  await arenaCommand(process.argv.slice(3));
} else if (cmd === "arena:v2") {
  const { runAgentArenaV2 } = await import("./execution/arena-v2");
  runAgentArenaV2(process.argv.slice(3));
} else if (cmd === "research:node") {
  const { runResearchNode } = await import("./execution/research-node");
  runResearchNode(process.argv.slice(3));
} else if (cmd === "oos:report" || cmd === "oos:grade") {
  const { runOosReport } = await import("./research/session-study");
  runOosReport(process.argv.slice(3));
} else if (cmd === "pnl:walkforward" || cmd === "pnl:cost-sweep" || cmd === "pnl:regime") {
  const { runWalkForwardPnl } = await import("./research/walkforward-pnl");
  runWalkForwardPnl(process.argv.slice(3));
} else if (cmd === "pnl:casefile" || cmd === "pnl:guarded-delta" || cmd === "pnl:attribution" || cmd === "pnl:safety-alpha" || cmd === "research:perp-leg-autopsy" || cmd === "research:tradeability-bridge") {
  const { runPnlCasefile } = await import("./research/pnl-casefile");
  runPnlCasefile();
} else if (cmd === "fill:stress" || cmd === "slippage:sweep" || cmd === "liquidity:replay") {
  const { runFillRealism } = await import("./research/fill-realism");
  runFillRealism();
} else if (cmd === "external:proof" || cmd === "sdk:example" || cmd === "mcp:integration-test") {
  const { runIntegrationProof } = await import("./execution/integration-proof");
  runIntegrationProof();
} else if (cmd === "bitget:smoke" || cmd === "bitget:read-only-proof" || cmd === "bitget:agent-hub-demo") {
  const { runBitgetReadOnlyProof } = await import("./integrations/bitget-agent-hub/readOnlyProof");
  await runBitgetReadOnlyProof();
} else if (cmd === "certify") {
  const { printCertify } = await import("./research/certify");
  await printCertify();
} else if (cmd === "gauntlet") {
  const { gauntletCommand } = await import("./research/arena");
  await gauntletCommand(process.argv.slice(3));
} else if (cmd === "firewall") {
  const { printFirewallDemo } = await import("./kernel/demo");
  await printFirewallDemo();
} else if (cmd === "judge") {
  const { runJudge } = await import("./judge");
  await runJudge();
} else if (cmd === "stress") {
  const { stressCommand } = await import("./research/stress");
  await stressCommand(process.argv.slice(3));
} else {
  console.log("NightDesk / PegWatch");
  console.log("Usage:");
  console.log("  npm run status            # one-shot live premium/depeg table");
  console.log("  npm run record            # start the persistent recorder loop");
  console.log("  npm run simulate [file]   # run a full NightDesk night + graded scorecard");
  console.log("  npm run dashboard         # serve the public PegWatch dashboard");
  process.exit(1);
}
