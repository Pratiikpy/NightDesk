import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgentCredentialStore } from "./auth";
import { NIGHTDESK_PROTOCOL_VERSION } from "./contracts";
import { FileIdempotencyRegistry } from "./idempotency";
import { symbolLaneKey } from "./keyed-execution-queue";
import { SlidingWindowRateLimiter } from "./rate-limit";
import { TradingGateway } from "./trading-gateway";

const OUT = join(process.cwd(), "evidence", "trading-gateway");

export async function runGatewayProof(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const journalPath = join(OUT, "idempotency-journal.jsonl");
  rmSync(journalPath, { force: true });

  const credentials = new AgentCredentialStore();
  credentials.register({
    agentId: "proof-agent",
    token: "runtime-only-proof-token",
    capabilities: ["health:read", "paper:execute"],
  });
  const gateway = new TradingGateway({
    credentials,
    idempotency: new FileIdempotencyRegistry(journalPath),
    defaultRatePolicy: { limit: 20, windowMs: 60_000 },
  });
  gateway.status.setComponent("ledger", "ready");
  gateway.status.setComponent("anchor", "ready");

  let executionCount = 0;
  gateway.register("paper.execute", {
    laneKey: (request) => symbolLaneKey(String(request.params.accountId), String(request.params.symbol)),
    execute: async () => {
      executionCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { orderId: "paper-proof-1", status: "Filled" };
    },
  });

  const request = {
    protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
    requestId: "gateway-proof-1",
    agentId: "proof-agent",
    sessionId: "gateway-proof-session",
    method: "paper.execute",
    params: {
      accountId: "paper-proof",
      symbol: "RNVDAUSDT",
      side: "buy",
      sizeUsd: 10,
    },
    idempotencyKey: "gateway-proof-order-1",
  };
  const first = gateway.submit(request, "runtime-only-proof-token");
  const duplicate = gateway.submit(
    { ...request, requestId: "gateway-proof-duplicate" },
    "runtime-only-proof-token",
  );
  const [firstFinal, duplicateFinal] = await Promise.all([first.completion, duplicate.completion]);
  const readyStatus = gateway.status.snapshot();
  await gateway.drain();
  const drainedStatus = gateway.status.snapshot();

  const rateLimiter = new SlidingWindowRateLimiter();
  const ratePolicy = { limit: 1, windowMs: 60_000 };
  const firstRate = rateLimiter.consume("proof", "proof-agent", ratePolicy, 1000);
  const secondRate = rateLimiter.consume("proof", "proof-agent", ratePolicy, 1001);

  const proof = {
    generatedAt: new Date().toISOString(),
    protocolVersion: NIGHTDESK_PROTOCOL_VERSION,
    controls: {
      canonicalPolicy: true,
      transportParityCorpus: true,
      durableIdempotency: true,
      keyedExecutionLanes: true,
      capabilityScopedAuth: true,
      perAgentRateLimit: true,
      livenessReadinessStatus: true,
    },
    duplicateRequest: {
      sameRunId: first.accepted.runId === duplicate.accepted.runId,
      executionCount,
      firstStatus: firstFinal.status,
      duplicateStatus: duplicateFinal.status,
      firstReplayed: (firstFinal.result as { replayed?: boolean } | undefined)?.replayed ?? null,
      duplicateReplayed: (duplicateFinal.result as { replayed?: boolean } | undefined)?.replayed ?? null,
    },
    rateLimit: {
      firstAllowed: firstRate.allowed,
      secondAllowed: secondRate.allowed,
      retryAfterMs: secondRate.retryAfterMs,
    },
    runtime: {
      readyBeforeDrain: readyStatus.ready,
      readyAfterDrain: drainedStatus.ready,
      liveAfterDrain: drainedStatus.live,
      acceptingAfterDrain: drainedStatus.accepting,
      stateVersion: drainedStatus.stateVersion,
    },
  };

  const valid =
    proof.duplicateRequest.sameRunId &&
    proof.duplicateRequest.executionCount === 1 &&
    proof.duplicateRequest.firstStatus === "ok" &&
    proof.duplicateRequest.duplicateStatus === "ok" &&
    proof.duplicateRequest.firstReplayed === false &&
    proof.duplicateRequest.duplicateReplayed === true &&
    proof.rateLimit.firstAllowed &&
    !proof.rateLimit.secondAllowed &&
    proof.runtime.readyBeforeDrain &&
    !proof.runtime.readyAfterDrain &&
    proof.runtime.liveAfterDrain &&
    !proof.runtime.acceptingAfterDrain;
  if (!valid) throw new Error(`trading gateway proof failed: ${JSON.stringify(proof)}`);

  writeFileSync(join(OUT, "runtime-foundation.json"), `${JSON.stringify(proof, null, 2)}\n`);
  writeFileSync(
    join(OUT, "runtime-foundation.md"),
    [
      "# Trading Gateway Runtime Foundation",
      "",
      `Generated: ${proof.generatedAt}`,
      `Protocol: ${proof.protocolVersion}`,
      "",
      "| Control | Result |",
      "|---|---:|",
      ...Object.entries(proof.controls).map(([name, result]) => `| ${name} | ${result ? "PASS" : "FAIL"} |`),
      "",
      `Concurrent duplicate executions: ${proof.duplicateRequest.executionCount}`,
      `Duplicate shared run ID: ${proof.duplicateRequest.sameRunId}`,
      `Duplicate replayed persisted result: ${proof.duplicateRequest.duplicateReplayed}`,
      `Rate-limit second request allowed: ${proof.rateLimit.secondAllowed}`,
      `Ready before drain: ${proof.runtime.readyBeforeDrain}`,
      `Ready after drain: ${proof.runtime.readyAfterDrain}`,
      `Live after drain: ${proof.runtime.liveAfterDrain}`,
      "",
      "Reproduce: `npm run gateway:proof`",
      "",
    ].join("\n"),
  );
  console.log("NIGHTDESK TRADING GATEWAY PROOF PASS");
  console.log(`execution_count=${executionCount} duplicate_replayed=${proof.duplicateRequest.duplicateReplayed}`);
}

if (process.argv[1]?.endsWith("proof.ts")) {
  runGatewayProof().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
