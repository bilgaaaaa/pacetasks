import assert from "node:assert/strict";
import { assertThrowsAIError } from "../testing/assertAIError.ts";
import { createAIProvider } from "./providerFactory.ts";

const env = (values: Record<string, string>) => (name: string) => values[name];
const request = { text: "call mom tomorrow, buy shampoo", todayKey: "2026-09-28", timeZone: "Europe/Rome", localeHint: null };

Deno.test("createAIProvider: AI_PROVIDER=rules needs no model or key and uses no tokens", async () => {
  const interpretation = await createAIProvider(env({ AI_PROVIDER: " Rules " }), "BRAIN_DUMP").parseBrainDump(request);

  assert.equal(interpretation.provider, "rules");
  assert.deepEqual(interpretation.usage, { inputTokens: 0, outputTokens: 0 });
  assert.deepEqual(interpretation.result.candidates.map((c) => c.title), ["Call mom", "Buy shampoo"]);
});

Deno.test("createAIProvider: a vendor still needs its model and key", () => {
  assertThrowsAIError(() => createAIProvider(env({ AI_PROVIDER: "anthropic" }), "BRAIN_DUMP"), "configuration");
  assertThrowsAIError(() => createAIProvider(env({}), "BRAIN_DUMP"), "configuration");
});
