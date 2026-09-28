import assert from "node:assert/strict";
import type { AIErrorKind } from "../errors.ts";
import { assertRejectsWithAIError } from "../../testing/assertAIError.ts";
import { fakeFetch } from "../../testing/fakeFetch.ts";
import { createOpenAIClient } from "./openaiClient.ts";

const request = {
  system: "rules",
  user: "text",
  schemaName: "brain_dump_result",
  schemaDescription: "d",
  jsonSchema: { type: "object" },
  maxOutputTokens: 100,
};

Deno.test("openai: sends a json_schema response format and parses the content", async () => {
  const { fetchFn, calls } = fakeFetch([
    {
      status: 200,
      body: {
        choices: [{ finish_reason: "stop", message: { content: '{"ok":true}', refusal: null } }],
        usage: { prompt_tokens: 120, completion_tokens: 40 },
      },
    },
  ]);
  const client = createOpenAIClient({ apiKey: "k", model: "m", fetchFn });

  const response = await client.generateStructured(request);

  assert.deepEqual(response, { output: { ok: true }, usage: { inputTokens: 120, outputTokens: 40 } });
  assert.deepEqual(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.deepEqual(calls[0].headers.authorization, "Bearer k");
  assert.deepEqual((calls[0].body.response_format as { type: string }).type, "json_schema");
});

Deno.test("openai: maps refusals, truncation and bad JSON to AIError kinds", async () => {
  const cases: Array<[unknown, AIErrorKind]> = [
    [{ choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }] }, "refused"],
    [{ choices: [{ finish_reason: "length", message: { content: '{"a":' } }] }, "truncated"],
    [{ choices: [{ finish_reason: "stop", message: { content: "Sure! Here are your tasks" } }] }, "invalid_output"],
  ];
  for (const [body, kind] of cases) {
    const client = createOpenAIClient({ apiKey: "k", model: "m", fetchFn: fakeFetch([{ status: 200, body }]).fetchFn });
    await assertRejectsWithAIError(() => client.generateStructured(request), kind);
  }
});
