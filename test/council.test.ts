import { test } from "node:test";
import assert from "node:assert/strict";
import { runCouncil, parseProposal, DEFAULT_LIMITS, type CouncilContext } from "../src/council/council";
import { MockLLMProvider, roleRouter } from "../src/llm/mock";
import type { EventCard } from "../src/perception/eventcard";

const card: EventCard = {
  eventId: "basis-NVDA-1000",
  type: "basis",
  tickers: ["NVDA"],
  directionHint: "long",
  magnitudeEst: 0.9,
  confidence: 0.8,
  halfLifeMin: 120,
  sources: ["RNVDAUSDT", "NVDAUSDT"],
  ts: 1000,
};
const ctx: CouncilContext = { ticker: "NVDA", instrument: "perp", price: 205, fairValue: 207, premiumPct: -0.9, pegState: "STRETCHED" };

test("council returns a TRADE proposal when the portfolio manager approves; usage summed over 7 calls", async () => {
  const llm = new MockLLMProvider(
    roleRouter({
      bull: "Premium gap is real, converge long.",
      bear: "Funding risk but bounded.",
      research_manager: "Stance LONG, conviction 0.7.",
      risk_aggressive: "Edge clears fees; size up.",
      risk_conservative: "Thin books; keep small.",
      risk_neutral: "Balanced; standard size.",
      portfolio_manager:
        '{"decision":"TRADE","side":"buy","instrument":"perp","sizePct":5,"stop":201,"takeProfit":207,"expectedEdgePct":0.9,"expectedHorizonMin":120,"isBasisArb":true,"citations":["event:magnitude_pct","market:premium_pct"],"thesis":"long rNVDA vs perp"}',
    })
  );
  const res = await runCouncil(llm, card, ctx);
  assert.equal(res.proposal.decision, "TRADE");
  assert.equal(res.proposal.side, "buy");
  assert.equal(res.proposal.sizePct, 5);
  assert.equal(res.proposal.isBasisArb, true);
  assert.equal(res.transcript.length, 7);
  assert.equal(res.usage.promptTokens, 70); // 7 × 10
  assert.equal(res.usage.completionTokens, 140); // 7 × 20
  assert.equal(res.grounding.grounded, true);
});

test("portfolio-manager NO_TRADE is respected", async () => {
  const llm = new MockLLMProvider(roleRouter({ portfolio_manager: '{"decision":"NO_TRADE","thesis":"premium below conviction"}' }));
  const res = await runCouncil(llm, card, ctx);
  assert.equal(res.proposal.decision, "NO_TRADE");
  assert.match(res.proposal.thesis, /conviction/);
});

test("garbage supervisor output fails safe to NO_TRADE", () => {
  const p = parseProposal("the market looks fine, no json here", card, ctx, DEFAULT_LIMITS);
  assert.equal(p.decision, "NO_TRADE");
});

test("oversize proposals are clamped to the limit", () => {
  const p = parseProposal('{"decision":"TRADE","side":"buy","sizePct":50,"thesis":"greedy"}', card, ctx, DEFAULT_LIMITS);
  assert.equal(p.decision, "TRADE");
  assert.equal(p.sizePct, DEFAULT_LIMITS.maxSizePct); // 10
});

test("zero size => NO_TRADE", () => {
  const p = parseProposal('{"decision":"TRADE","side":"buy","sizePct":0,"thesis":"meh"}', card, ctx, DEFAULT_LIMITS);
  assert.equal(p.decision, "NO_TRADE");
});

test("council rejects a TRADE that lacks evidence citations", async () => {
  const llm = new MockLLMProvider(roleRouter({ portfolio_manager: '{"decision":"TRADE","side":"buy","sizePct":5,"expectedEdgePct":0.9,"thesis":"unsupported"}' }));
  const result = await runCouncil(llm, card, ctx);
  assert.equal(result.proposal.decision, "NO_TRADE");
  assert.equal(result.grounding.grounded, false);
  assert.match(result.proposal.thesis, /grounding failed/);
});

test("council rejects cited trades with a conflicting side or invented edge", async () => {
  const llm = new MockLLMProvider(roleRouter({ portfolio_manager: '{"decision":"TRADE","side":"sell","sizePct":5,"expectedEdgePct":9,"citations":["event:magnitude_pct","market:premium_pct"],"thesis":"invented"}' }));
  const result = await runCouncil(llm, card, ctx);
  assert.equal(result.proposal.decision, "NO_TRADE");
  assert.ok(result.grounding.failures.some((failure) => failure.includes("side")));
  assert.ok(result.grounding.failures.some((failure) => failure.includes("edge")));
});
