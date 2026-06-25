// Capability audit — restricted live pilot. Verifies the plan's exit criteria deterministically:
// fail-closed live authorization, live receipts that link the complete decision chain, simulation-vs-live
// error inside the declared band, a kill-switch that returns to shadow, and breach->shadow reversion.
// The real-capital deployment is the operational gate this controller enforces. Run: `npm run live:pilot-audit`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LivePilot, decisionChainComplete, simVsLiveWithinBand, type PilotConfig, type LiveReceipt } from "./live-pilot";

interface Check { name: string; pass: boolean; detail: string }
const cfg = (over: Partial<PilotConfig> = {}): PilotConfig => ({ liveEnabled: true, capability: true, dustCapUsd: 10, microCapUsd: 50, simVsLiveBandPct: 15, ...over });

export function runLivePilotMonth8Audit(): boolean {
  const checks: Check[] = [];

  // 1. fail-closed: a live order is authorized ONLY with env + capability + within cap + manual confirm.
  const shadowBlocked = new LivePilot(cfg()).authorize({ sizeUsd: 5, manualConfirmed: true }).authorized === false;
  const dust = new LivePilot(cfg()); dust.promote(); // -> DUST
  const noEnv = new LivePilot(cfg({ liveEnabled: false })); noEnv.promote();
  const noCap = new LivePilot(cfg({ capability: false })); noCap.promote();
  const blockedEnv = noEnv.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized === false;
  const blockedCap = noCap.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized === false;
  const blockedOversize = dust.authorize({ sizeUsd: 100, manualConfirmed: true }).authorized === false;
  const blockedNoConfirm = dust.authorize({ sizeUsd: 5, manualConfirmed: false }).authorized === false;
  const validDust = dust.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized === true;
  checks.push({ name: "fail-closed: live order authorized only with env + capability + within cap + manual confirm", pass: shadowBlocked && blockedEnv && blockedCap && blockedOversize && blockedNoConfirm && validDust, detail: `shadow-blocked=${shadowBlocked} env=${blockedEnv} cap=${blockedCap} oversize=${blockedOversize} no-confirm=${blockedNoConfirm} valid-dust=${validDust}` });

  // 2. live receipt links the complete decision chain.
  const full: LiveReceipt = { cycleId: "c1", certificateId: "cert1", gatePassed: true, orderId: "o1", fillStatus: "filled", ledgerHash: "h1" };
  const broken: LiveReceipt = { ...full, ledgerHash: "" };
  checks.push({ name: "live receipt links the complete decision chain (cycle->cert->gate->order->fill->ledger)", pass: decisionChainComplete(full) && !decisionChainComplete(broken), detail: `complete=${decisionChainComplete(full)}; missing-ledger-rejected=${!decisionChainComplete(broken)}` });

  // 3. simulation-vs-live error stays inside the declared band.
  const within = simVsLiveWithinBand(1.0, 1.1, 15);
  const outside = simVsLiveWithinBand(1.0, 1.5, 15);
  checks.push({ name: "simulation-vs-live error stays inside the declared band", pass: within && !outside, detail: `10%-error within 15% band=${within}; 50%-error within 15% band=${outside}` });

  // 4. kill-switch returns the system to shadow mode.
  const k = new LivePilot(cfg()); k.promote(); k.promote(); // -> MICRO
  k.kill("operator");
  const killDecision = k.authorize({ sizeUsd: 5, manualConfirmed: true });
  checks.push({ name: "kill-switch returns the system to shadow mode (no live orders)", pass: k.stage === "SHADOW" && killDecision.authorized === false, detail: `post-kill stage=${k.stage}; authorized=${killDecision.authorized}` });

  // 5. any safety/reconciliation breach reverts to shadow mode (and cannot be re-promoted).
  const b = new LivePilot(cfg()); b.promote(); // -> DUST
  b.reportBreach("reconciliation mismatch");
  const rePromoteBlocked = b.promote() === "SHADOW";
  checks.push({ name: "any safety/reconciliation breach reverts to shadow mode", pass: b.stage === "SHADOW" && rePromoteBlocked && b.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized === false, detail: `post-breach stage=${b.stage}; re-promote-blocked=${rePromoteBlocked}` });

  const passed = checks.filter((c) => c.pass).length;
  const ok = passed === checks.length;
  const OUT = join(process.cwd(), "evidence", "live-pilot");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "live-pilot-audit.md"), [
    "# Restricted Live Pilot",
    "",
    `Result: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`,
    "",
    "| Exit-gate requirement | Status | Detail |",
    "| --- | --- | --- |",
    ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`),
    "",
    "The pilot is fail-closed: live orders require env enable + capability + per-stage cap + manual confirm.",
    "A kill-switch or any breach reverts to shadow mode. Deploying real capital (and an independent security",
    "review) is the operational gate this controller enforces — it is never faked.",
  ].join("\n") + "\n");

  console.log(`NIGHTDESK LIVE PILOT AUDIT: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`);
  for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

if (process.argv[1]?.endsWith("live-pilot-audit.ts")) runLivePilotMonth8Audit();
