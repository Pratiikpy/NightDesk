import { test } from "node:test";
import assert from "node:assert/strict";
import { attributeGates } from "../src/ledger/scorecard";
import type { CycleRecord } from "../src/ledger/ledger";

const gated = (gate: string, wouldBePnlPct: number): CycleRecord =>
  ({
    outcome: "gated",
    gateReport: { passed: false, results: [{ gate, passed: false, detail: "" }] },
    counterfactual: { wouldBePnlPct, wouldHaveConverged: wouldBePnlPct > 0, decisionWasRight: wouldBePnlPct <= 0 },
  }) as unknown as CycleRecord;

test("attributeGates: a gate that blocks losing trades shows a negative avg would-be PnL", () => {
  const recs = [gated("2_max_gross", -1.0), gated("2_max_gross", -0.5), gated("5_event_confidence", 0.2)];
  const attr = attributeGates(recs);
  const mg = attr.find((a) => a.gate === "2_max_gross")!;
  assert.equal(mg.blocked, 2);
  assert.equal(mg.avgWouldBePnlPct, -0.75, "blocked trades would have averaged −0.75pp → gate avoided losses");
  // sorted worst-avoided-loss first
  assert.equal(attr[0]!.gate, "2_max_gross");
});
