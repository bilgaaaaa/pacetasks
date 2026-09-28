import { createAnthropicClient } from "./clients/anthropicClient.ts";
import { createOpenAIClient } from "./clients/openaiClient.ts";
import { AIError } from "./errors.ts";
import { AI_PROVIDER_NAMES } from "./LLMClient.ts";
import type { AIProviderName, FetchFn, LLMClient } from "./LLMClient.ts";

// AI features with their own model setting, e.g. AI_MODEL_BRAIN_DUMP.
export type AIFeature = "BRAIN_DUMP";

export interface AIConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
}

const API_KEY_ENV: Record<AIProviderName, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

// Reads which vendor/model a feature uses from secrets, so switching vendor or
// model is a secret change, not a code change. There is deliberately no default
// model: model names change, and a stale default would fail silently.
export function readAIConfig(env: (name: string) => string | undefined, feature: AIFeature): AIConfig {
  const provider = env("AI_PROVIDER")?.trim().toLowerCase();
  if (!provider || !(AI_PROVIDER_NAMES as readonly string[]).includes(provider)) {
    throw new AIError("configuration", `AI_PROVIDER must be one of: ${AI_PROVIDER_NAMES.join(", ")}`);
  }

  const model = env(`AI_MODEL_${feature}`)?.trim();
  if (!model) throw new AIError("configuration", `AI_MODEL_${feature} is not set`);

  const keyName = API_KEY_ENV[provider as AIProviderName];
  const apiKey = env(keyName)?.trim();
  if (!apiKey) throw new AIError("configuration", `${keyName} is not set`);

  return { provider: provider as AIProviderName, model, apiKey };
}

export function createLLMClient(config: AIConfig, fetchFn?: FetchFn): LLMClient {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicClient({ apiKey: config.apiKey, model: config.model, fetchFn });
    case "openai":
      return createOpenAIClient({ apiKey: config.apiKey, model: config.model, fetchFn });
  }
}
