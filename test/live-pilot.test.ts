import { test } from "node:test";
import assert from "node:assert/strict";
import { LivePilot, decisionChainComplete, simVsLiveWithinBand, type PilotConfig } from "../src/execution/live-pilot";

const cfg: PilotConfig = { liveEnabled: true, capability: true, dustCapUsd: 10, microCapUsd: 50, simVsLiveBandPct: 15 };

test("shadow mode authorizes no live orders", () => {
  assert.equal(new LivePilot(cfg).authorize({ sizeUsd: 5, manualConfirmed: true }).authorized, false);
});

test("dust stage authorizes a confirmed within-cap order, rejects oversize/unconfirmed", () => {
  const p = new LivePilot(cfg);
  p.promote();
  assert.equal(p.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized, true);
  assert.equal(p.authorize({ sizeUsd: 100, manualConfirmed: true }).authorized, false);
  assert.equal(p.authorize({ sizeUsd: 5, manualConfirmed: false }).authorized, false);
});

test("env and capability gates fail closed", () => {
  const noEnv = new LivePilot({ ...cfg, liveEnabled: false });
  noEnv.promote();
  const noCap = new LivePilot({ ...cfg, capability: false });
  noCap.promote();
  assert.equal(noEnv.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized, false);
  assert.equal(noCap.authorize({ sizeUsd: 5, manualConfirmed: true }).authorized, false);
});

test("kill-switch and breach revert to shadow and block promotion", () => {
  const k = new LivePilot(cfg);
  k.promote();
  k.kill("operator");
  assert.equal(k.stage, "SHADOW");
  assert.equal(k.promote(), "SHADOW");
  const b = new LivePilot(cfg);
  b.promote();
  b.reportBreach("reconciliation");
  assert.equal(b.stage, "SHADOW");
  assert.equal(b.promote(), "SHADOW");
});

test("decision-chain completeness and sim-vs-live band helpers", () => {
  assert.equal(decisionChainComplete({ cycleId: "c", certificateId: "x", gatePassed: true, orderId: "o", fillStatus: "filled", ledgerHash: "h" }), true);
  assert.equal(decisionChainComplete({ cycleId: "c", certificateId: "x", gatePassed: false, orderId: "o", fillStatus: "filled", ledgerHash: "h" }), false);
  assert.equal(simVsLiveWithinBand(1, 1.1, 15), true);
  assert.equal(simVsLiveWithinBand(1, 1.5, 15), false);
});
