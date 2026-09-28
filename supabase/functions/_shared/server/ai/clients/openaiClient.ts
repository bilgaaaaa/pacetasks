import { AIError } from "../errors.ts";
import { postJson } from "../http.ts";
import type { FetchFn, LLMClient, StructuredRequest, StructuredResponse } from "../LLMClient.ts";

export interface OpenAIClientOptions {
  apiKey: string;
  model: string;
  fetchFn?: FetchFn;
  timeoutMs?: number;
  baseUrl?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// OpenAI Chat Completions adapter using JSON-schema response format. Strict
// mode is off because it restricts schema keywords; our zod validation is the
// real gate either way.
export function createOpenAIClient(options: OpenAIClientOptions): LLMClient {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.openai.com";
  const timeoutMs = options.timeoutMs ?? 25_000;

  return {
    provider: "openai",
    model: options.model,

    async generateStructured(request: StructuredRequest): Promise<StructuredResponse> {
      const raw = (await postJson(
        fetchFn,
        `${baseUrl}/v1/chat/completions`,
        { authorization: `Bearer ${options.apiKey}` },
        {
          model: options.model,
          max_completion_tokens: request.maxOutputTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              description: request.schemaDescription,
              schema: request.jsonSchema,
              strict: false,
            },
          },
        },
        timeoutMs
      )) as OpenAIChatResponse;

      const choice = raw.choices?.[0];
      if (choice?.message?.refusal) throw new AIError("refused", "The model declined this request");
      if (choice?.finish_reason === "length") throw new AIError("truncated", "Output hit the token limit");

      const content = choice?.message?.content;
      if (!content) throw new AIError("invalid_output", "Response contained no content");

      let output: unknown;
      try {
        output = JSON.parse(content);
      } catch {
        throw new AIError("invalid_output", "Response content was not valid JSON");
      }

      return {
        output,
        usage: {
          inputTokens: raw.usage?.prompt_tokens ?? 0,
          outputTokens: raw.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
