import { test } from "node:test";
import assert from "node:assert/strict";
import { capitalScore, liquidityScore, selectChampionLanes, classifyForwardStatus, type LaneCandidate, type ObjectiveInput } from "../src/research/championship/pnl-objectives";

const obj = (netPnl: number, maxDrawdown: number, fees: number, trades: number, implementationShortfall = 0): ObjectiveInput =>
  ({ netPnl, maxDrawdown, fees, trades, blocks: 0, blockedLossAvoided: 0, falseBlockCost: 0, implementationShortfall });
const c = (id: string, netPnl: number, maxDrawdown: number, fees: number, trades: number, hardGatesPassed = true, shortfall = 0): LaneCandidate =>
  ({ id, hardGatesPassed, objective: obj(netPnl, maxDrawdown, fees, trades, shortfall) });

test("capital & liquidity scores reward efficiency and low implementation shortfall", () => {
  assert.ok(capitalScore(obj(20, 2, 0, 0)) > capitalScore(obj(20, 20, 0, 0)), "return per drawdown");
  assert.ok(liquidityScore(obj(30, 0, 1, 10, 0)) > liquidityScore(obj(30, 0, 1, 10, 20)), "lower shortfall scores higher");
});

test("four champion lanes diverge to distinct winners and exclude unsafe candidates", () => {
  const lanes = selectChampionLanes([
    c("A_pnl", 60, 35, 6, 300, true, 30),
    c("B_safety", 28, 3, 2, 50, true, 5),
    c("C_liquidity", 34, 12, 1, 10, true, 0),
    c("D_capital", 22, 2, 1, 15, true, 1),
    c("E_unsafe", 999, 1, 0, 1, false, 0),
  ]);
  assert.equal(lanes.pnl, "A_pnl");
  assert.equal(lanes.safety, "B_safety");
  assert.equal(lanes.capital, "D_capital");
  assert.equal(lanes.liquidity, "C_liquidity");
  assert.ok(!Object.values(lanes).includes("E_unsafe"), "unsafe candidate is never a champion");
});

test("a locked lane stays frozen against a higher-scoring re-fit", () => {
  const lanes = selectChampionLanes([c("A", 10, 2, 1, 10), c("B", 20, 2, 1, 10)], { pnl: "A" });
  assert.equal(lanes.pnl, "A", "B scores higher but A is locked/frozen");
});

test("forward status classifier retires/benches degraded champions, keeps healthy ones active", () => {
  assert.equal(classifyForwardStatus(-8, 12, 50), "RETIRE");
  assert.equal(classifyForwardStatus(10, 4, 50), "WATCH");
  assert.equal(classifyForwardStatus(55, 6, 50), "ACTIVE");
});
