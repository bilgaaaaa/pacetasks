import { AIError } from "../errors.ts";
import { postJson } from "../http.ts";
import type { FetchFn, LLMClient, StructuredRequest, StructuredResponse } from "../LLMClient.ts";

const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicClientOptions {
  apiKey: string;
  model: string;
  fetchFn?: FetchFn;
  timeoutMs?: number;
  baseUrl?: string;
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; name?: string; input?: unknown }>;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

// Anthropic Messages API adapter. Structured output is enforced by forcing a
// single tool call whose input schema is the requested JSON schema; the stable
// system prompt is marked cacheable to cut input cost on repeat requests.
export function createAnthropicClient(options: AnthropicClientOptions): LLMClient {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com";
  const timeoutMs = options.timeoutMs ?? 25_000;

  return {
    provider: "anthropic",
    model: options.model,

    async generateStructured(request: StructuredRequest): Promise<StructuredResponse> {
      const raw = (await postJson(
        fetchFn,
        `${baseUrl}/v1/messages`,
        { "x-api-key": options.apiKey, "anthropic-version": ANTHROPIC_VERSION },
        {
          model: options.model,
          max_tokens: request.maxOutputTokens,
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: request.user }],
          tools: [
            {
              name: request.schemaName,
              description: request.schemaDescription,
              input_schema: request.jsonSchema,
            },
          ],
          tool_choice: { type: "tool", name: request.schemaName },
        },
        timeoutMs
      )) as AnthropicMessageResponse;

      if (raw.stop_reason === "refusal") throw new AIError("refused", "The model declined this request");
      if (raw.stop_reason === "max_tokens") throw new AIError("truncated", "Output hit the token limit");

      const toolUse = raw.content?.find((block) => block.type === "tool_use" && block.name === request.schemaName);
      if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
        throw new AIError("invalid_output", "Response contained no structured tool output");
      }

      const usage = raw.usage ?? {};
      return {
        output: toolUse.input,
        usage: {
          inputTokens:
            (usage.input_tokens ?? 0) +
            (usage.cache_creation_input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0),
          outputTokens: usage.output_tokens ?? 0,
        },
      };
    },
  };
}
