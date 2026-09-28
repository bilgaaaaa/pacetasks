import assert from "node:assert/strict";
import { assertThrowsAIError } from "../testing/assertAIError.ts";
import { readAIConfig } from "./clientFactory.ts";

const env = (values: Record<string, string>) => (name: string) => values[name];

Deno.test("readAIConfig: reads provider, per-feature model and the matching key", () => {
  assert.deepEqual(
    readAIConfig(env({ AI_PROVIDER: "Anthropic", AI_MODEL_BRAIN_DUMP: "some-model", ANTHROPIC_API_KEY: "k" }), "BRAIN_DUMP"),
    { provider: "anthropic", model: "some-model", apiKey: "k" }
  );
});

Deno.test("readAIConfig: fails loudly on missing or unknown settings", () => {
  const broken: Array<Record<string, string>> = [
    {},
    { AI_PROVIDER: "gemini", AI_MODEL_BRAIN_DUMP: "m", ANTHROPIC_API_KEY: "k" },
    { AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "k" },
    { AI_PROVIDER: "openai", AI_MODEL_BRAIN_DUMP: "m", ANTHROPIC_API_KEY: "k" },
  ];
  for (const values of broken) {
    assertThrowsAIError(() => readAIConfig(env(values), "BRAIN_DUMP"), "configuration");
  }
});
