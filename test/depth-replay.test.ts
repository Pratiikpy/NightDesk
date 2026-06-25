import { test } from "node:test";
import assert from "node:assert/strict";
import { replayExecution, type ExecutionReplayEvent } from "../src/execution/depth-replay";

const events: ExecutionReplayEvent[] = [
  { sequence: 1, ts: 1, type: "MARKET", quote: { symbol: "NVDAUSDT", bid: 99, ask: 100, last: 100, book: { bids: [[99, 5]], asks: [[100, 1], [101, 5]] } } },
  { sequence: 2, ts: 2, type: "ORDER", order: { id: "limit", accountId: "a", symbol: "NVDAUSDT", kind: "perp", side: "buy", type: "limit", qty: 3, limitPrice: 100, ts: 2 } },
  { sequence: 3, ts: 3, type: "MARKET", quote: { symbol: "NVDAUSDT", bid: 99, ask: 100, last: 100, book: { bids: [[99, 5]], asks: [[100, 2], [101, 5]] } } },
];

test("ordered depth replay is deterministic and preserves partial remainders", () => {
  const first = replayExecution({ accounts: [{ id: "a", cash: 1_000 }], events });
  const second = replayExecution({ accounts: [{ id: "a", cash: 1_000 }], events });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first, second);
  assert.equal(first.fills.length, 2);
  assert.equal(first.fills[0]!.status, "partial");
  assert.equal(first.fills[0]!.qty, 1);
  assert.equal(first.fills[1]!.status, "filled");
  assert.equal(first.fills[1]!.qty, 2);
  assert.equal(first.pending.length, 0);
});

test("depth replay rejects sequence gaps, timestamp regressions, and orders without market state", () => {
  assert.throws(() => replayExecution({ accounts: [{ id: "a", cash: 1_000 }], events: [{ ...events[0]!, sequence: 2 }] }), /sequence gap/);
  assert.throws(() => replayExecution({ accounts: [{ id: "a", cash: 1_000 }], events: [events[0]!, { ...events[1]!, ts: 0 }] }), /timestamp regression/);
  assert.throws(() => replayExecution({ accounts: [{ id: "a", cash: 1_000 }], events: [{ ...events[1]!, sequence: 1 }] }), /no prior market state/);
});
