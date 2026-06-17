// Pluggable LLM provider interface (PRD FR-4.5). Swap Qwen <-> mock via config.
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}
export interface LLMResult {
  text: string;
  usage: LLMUsage;
}
export interface LLMCompleteOpts {
  temperature?: number;
  maxTokens?: number;
}
export interface LLMProvider {
  readonly name: string;
  complete(messages: LLMMessage[], opts?: LLMCompleteOpts): Promise<LLMResult>;
}

export const emptyUsage = (): LLMUsage => ({ promptTokens: 0, completionTokens: 0 });
export function addUsage(a: LLMUsage, b: LLMUsage): LLMUsage {
  return { promptTokens: a.promptTokens + b.promptTokens, completionTokens: a.completionTokens + b.completionTokens };
}
