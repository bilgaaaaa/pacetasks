import assert from "node:assert/strict";
import type { AIErrorKind } from "../errors.ts";
import { assertRejectsWithAIError } from "../../testing/assertAIError.ts";
import { fakeFetch } from "../../testing/fakeFetch.ts";
import { createAnthropicClient } from "./anthropicClient.ts";

const request = {
  system: "rules",
  user: "text",
  schemaName: "brain_dump_result",
  schemaDescription: "d",
  jsonSchema: { type: "object" },
  maxOutputTokens: 100,
};

Deno.test("anthropic: forces the tool, caches the system prompt and returns tool input", async () => {
  const { fetchFn, calls } = fakeFetch([
    {
      status: 200,
      body: {
        content: [{ type: "tool_use", name: "brain_dump_result", input: { ok: true } }],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, cache_read_input_tokens: 900, output_tokens: 50 },
      },
    },
  ]);
  const client = createAnthropicClient({ apiKey: "k", model: "m", fetchFn });

  const response = await client.generateStructured(request);

  assert.deepEqual(response, { output: { ok: true }, usage: { inputTokens: 1000, outputTokens: 50 } });
  assert.deepEqual(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.deepEqual(calls[0].headers["x-api-key"], "k");
  assert.deepEqual(calls[0].body.tool_choice, { type: "tool", name: "brain_dump_result" });
  assert.deepEqual((calls[0].body.system as Array<{ cache_control: unknown }>)[0].cache_control, { type: "ephemeral" });
});

Deno.test("anthropic: maps stop reasons and HTTP errors to AIError kinds", async () => {
  const cases: Array<[{ status: number; body: unknown }, AIErrorKind]> = [
    [{ status: 200, body: { content: [], stop_reason: "max_tokens" } }, "truncated"],
    [{ status: 200, body: { content: [], stop_reason: "refusal" } }, "refused"],
    [{ status: 200, body: { content: [{ type: "text", text: "hi" }], stop_reason: "end_turn" } }, "invalid_output"],
    [{ status: 429, body: {} }, "rate_limited"],
    [{ status: 529, body: {} }, "unavailable"],
    [{ status: 401, body: {} }, "configuration"],
  ];
  for (const [response, kind] of cases) {
    const client = createAnthropicClient({ apiKey: "k", model: "m", fetchFn: fakeFetch([response]).fetchFn });
    await assertRejectsWithAIError(() => client.generateStructured(request), kind);
  }
});

Deno.test("anthropic: network failure is 'unavailable'", async () => {
  const client = createAnthropicClient({ apiKey: "k", model: "m", fetchFn: fakeFetch([]).fetchFn });
  await assertRejectsWithAIError(() => client.generateStructured(request), "unavailable");
});
