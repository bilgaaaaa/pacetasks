// The only boundary that knows an AI vendor exists. Each adapter turns a
// "give me JSON matching this schema" request into its vendor's API call.

export const AI_PROVIDER_NAMES = ["anthropic", "openai"] as const;
export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

export interface StructuredRequest {
  system: string; // stable instructions; adapters may cache this across requests
  user: string; // the per-request content
  schemaName: string; // letters, digits, "_" or "-" (vendor naming rules)
  schemaDescription: string;
  jsonSchema: Record<string, unknown>; // must describe a JSON object
  maxOutputTokens: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredResponse {
  output: unknown; // parsed JSON, not yet validated against the schema
  usage: TokenUsage;
}

export interface LLMClient {
  readonly provider: AIProviderName;
  readonly model: string;
  generateStructured(request: StructuredRequest): Promise<StructuredResponse>;
}

export type FetchFn = typeof fetch;
