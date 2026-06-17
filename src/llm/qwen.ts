// Qwen provider — Bitget hackathon proxy (OpenAI-compatible chat/completions).
// Base URL + model + key from .env (QWEN_BASE_URL / QWEN_MODEL / QWEN_API_KEY|BITGET_QWEN_API_KEY).
// Routes through the Bitget proxy, NOT the official Qwen API (see hackathon-info.md).
import type { LLMMessage, LLMProvider, LLMResult, LLMCompleteOpts } from "./provider";

export interface QwenConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function qwenConfigFromEnv(env: NodeJS.ProcessEnv = process.env): QwenConfig {
  const apiKey = env.QWEN_API_KEY || env.BITGET_QWEN_API_KEY || "";
  return {
    baseUrl: env.QWEN_BASE_URL || "https://hackathon.bitgetops.com/v1",
    model: env.QWEN_MODEL || "qwen3.6-plus",
    apiKey,
  };
}

export class QwenProvider implements LLMProvider {
  readonly name = "qwen";
  private cfg: QwenConfig;
  constructor(cfg?: Partial<QwenConfig>) {
    this.cfg = { ...qwenConfigFromEnv(), ...cfg };
  }

  async complete(messages: LLMMessage[], opts: LLMCompleteOpts = {}): Promise<LLMResult> {
    if (!this.cfg.apiKey) throw new Error("Qwen API key missing (set QWEN_API_KEY in .env)");
    const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 800,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Qwen HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return {
      text,
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
      },
    };
  }
}
