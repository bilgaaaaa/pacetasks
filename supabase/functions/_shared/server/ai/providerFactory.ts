import { RULES_PROVIDER_NAME } from "./AIProvider.ts";
import type { AIProvider } from "./AIProvider.ts";
import { createLLMClient, readAIConfig } from "./clientFactory.ts";
import type { AIFeature } from "./clientFactory.ts";
import type { FetchFn } from "./LLMClient.ts";
import { createPaceAIProvider } from "./paceAIProvider.ts";
import { createRulesAIProvider } from "./rulesAIProvider.ts";

// True when AI_PROVIDER selects the built-in rules instead of an AI vendor.
export function usesRulesProvider(env: (name: string) => string | undefined): boolean {
  return env("AI_PROVIDER")?.trim().toLowerCase() === RULES_PROVIDER_NAME;
}

// Builds the AIProvider a feature runs on, from secrets. AI_PROVIDER=rules gives
// the free rule-based parser (no model, no key); any other value must be a
// configured AI vendor. Switching between them is a secret change, not a deploy.
export function createAIProvider(
  env: (name: string) => string | undefined,
  feature: AIFeature,
  fetchFn?: FetchFn
): AIProvider {
  if (usesRulesProvider(env)) return createRulesAIProvider();
  return createPaceAIProvider(createLLMClient(readAIConfig(env, feature), fetchFn));
}
