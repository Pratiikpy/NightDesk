import { test } from "node:test";
import assert from "node:assert/strict";
import { runReleaseMonth12Audit } from "../src/ops/release-audit";

test("Month 12 release audit passes the full release-readiness checklist", () => {
  assert.equal(runReleaseMonth12Audit(), true);
});
