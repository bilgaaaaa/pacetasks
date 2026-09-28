import assert from "node:assert/strict";
import { assertRejectsWithAIError } from "../testing/assertAIError.ts";
import type { LLMClient, StructuredRequest } from "./LLMClient.ts";
import { createPaceAIProvider } from "./paceAIProvider.ts";
import { BRAIN_DUMP_PROMPT_VERSION } from "./prompts/brainDumpPrompt.ts";
import { SAMPLE_AI_RESULT } from "../testing/sampleAiResult.ts";

// An LLMClient that returns queued outputs and records each request.
function scriptedClient(outputs: unknown[]): LLMClient & { requests: StructuredRequest[] } {
  const requests: StructuredRequest[] = [];
  return {
    provider: "anthropic",
    model: "test-model",
    requests,
    generateStructured(request) {
      requests.push(request);
      return Promise.resolve({ output: outputs.shift(), usage: { inputTokens: 1000, outputTokens: 200 } });
    },
  };
}

const request = { text: "domani devo chiamare il veterinario", todayKey: "2026-09-28", timeZone: "Europe/Rome", localeHint: "en-IT" };

Deno.test("parseBrainDump: returns the validated result with provenance and usage", async () => {
  const client = scriptedClient([SAMPLE_AI_RESULT]);

  const interpretation = await createPaceAIProvider(client).parseBrainDump(request);

  assert.deepEqual(interpretation.result, SAMPLE_AI_RESULT);
  assert.deepEqual(interpretation.promptVersion, BRAIN_DUMP_PROMPT_VERSION);
  assert.deepEqual(interpretation.attempts, 1);
  assert.deepEqual(interpretation.usage, { inputTokens: 1000, outputTokens: 200 });
  assertIncludes(client.requests[0].user, "Today is Monday, 2026-09-28 (time zone Europe/Rome)");
  assertIncludes(client.requests[0].user, "<brain_dump>\ndomani devo chiamare il veterinario\n</brain_dump>");
});

Deno.test("parseBrainDump: retries once with the validation errors, then succeeds", async () => {
  const client = scriptedClient([{ schemaVersion: 1, candidates: "nope" }, SAMPLE_AI_RESULT]);

  const interpretation = await createPaceAIProvider(client).parseBrainDump(request);

  assert.deepEqual(interpretation.attempts, 2);
  assert.deepEqual(interpretation.usage, { inputTokens: 2000, outputTokens: 400 });
  assertIncludes(client.requests[1].user, "did not match the required schema");
  assertIncludes(client.requests[1].user, "candidates");
});

Deno.test("parseBrainDump: rejects after repeated invalid output", async () => {
  const client = scriptedClient(["prose", { schemaVersion: 2 }]);

  await assertRejectsWithAIError(() => createPaceAIProvider(client).parseBrainDump(request), "invalid_output");
  assert.deepEqual(client.requests.length, 2);
});

function assertIncludes(actual: string, expected: string): void {
  assert.ok(actual.includes(expected), `expected to include: ${expected}`);
}
