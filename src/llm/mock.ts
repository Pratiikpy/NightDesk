// Deterministic mock LLM provider for tests + offline replay (no network, no cost).
import type { LLMMessage, LLMProvider, LLMResult, LLMCompleteOpts } from "./provider";

export type MockResponder = (messages: LLMMessage[], opts?: LLMCompleteOpts) => string;

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";
  private responder: MockResponder;
  calls: { messages: LLMMessage[]; opts?: LLMCompleteOpts }[] = [];

  constructor(responder: MockResponder) {
    this.responder = responder;
  }

  async complete(messages: LLMMessage[], opts?: LLMCompleteOpts): Promise<LLMResult> {
    this.calls.push({ messages, opts });
    const text = this.responder(messages, opts);
    return { text, usage: { promptTokens: 10, completionTokens: 20 } };
  }
}

/** Route by the [ROLE:NAME] tag in the system prompt → map[name]. Handy for council tests. */
export function roleRouter(map: Record<string, string>): MockResponder {
  return (messages) => {
    const sys = messages.find((m) => m.role === "system")?.content ?? "";
    const tag = (/\[ROLE:(\w+)\]/.exec(sys)?.[1] ?? "").toLowerCase();
    if (tag && map[tag] != null) return map[tag];
    // fallback: the decision-maker, else the last provided response
    return map["portfolio_manager"] ?? map["supervisor"] ?? Object.values(map).slice(-1)[0] ?? "{}";
  };
}
