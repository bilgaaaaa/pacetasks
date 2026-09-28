import { z } from "zod";
import { brainDumpAiResultSchema } from "../../domain/brainDump/aiResult.ts";
import type { BrainDumpAiResult } from "../../domain/brainDump/aiResult.ts";
import { CATEGORY_IDS } from "../../domain/categories.ts";
import { weekdayName } from "../../domain/dates.ts";
import type { AIInterpretation, AIProvider, BrainDumpInterpretationRequest } from "./AIProvider.ts";
import { AIError } from "./errors.ts";
import type { LLMClient, TokenUsage } from "./LLMClient.ts";
import {
  BRAIN_DUMP_PROMPT_VERSION,
  BRAIN_DUMP_SYSTEM_PROMPT,
  buildBrainDumpUserMessage,
} from "./prompts/brainDumpPrompt.ts";

const BRAIN_DUMP_MAX_OUTPUT_TOKENS = 4000;
const DEFAULT_MAX_ATTEMPTS = 2;

// The JSON schema vendors receive, generated from the same zod schema that
// validates the answer, so the two can never drift apart.
const BRAIN_DUMP_JSON_SCHEMA = toVendorJsonSchema(brainDumpAiResultSchema);

// PaceTasks' AIProvider on top of any vendor's LLMClient. Output that fails
// schema validation is retried once with the validation errors, then rejected.
export function createPaceAIProvider(client: LLMClient, maxAttempts = DEFAULT_MAX_ATTEMPTS): AIProvider {
  return {
    async parseBrainDump(request: BrainDumpInterpretationRequest): Promise<AIInterpretation<BrainDumpAiResult>> {
      const baseMessage = buildBrainDumpUserMessage({
        text: request.text,
        todayKey: request.todayKey,
        weekday: weekdayName(request.todayKey),
        timeZone: request.timeZone,
        localeHint: request.localeHint,
        categoryIds: CATEGORY_IDS,
      });

      const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let userMessage = baseMessage;
      let lastIssues: string[] = [];

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const response = await client.generateStructured({
          system: BRAIN_DUMP_SYSTEM_PROMPT,
          user: userMessage,
          schemaName: "brain_dump_result",
          schemaDescription: "Task candidates extracted from the user's brain dump.",
          jsonSchema: BRAIN_DUMP_JSON_SCHEMA,
          maxOutputTokens: BRAIN_DUMP_MAX_OUTPUT_TOKENS,
        });
        usage.inputTokens += response.usage.inputTokens;
        usage.outputTokens += response.usage.outputTokens;

        const parsed = brainDumpAiResultSchema.safeParse(response.output);
        if (parsed.success) {
          return {
            result: parsed.data,
            provider: client.provider,
            model: client.model,
            promptVersion: BRAIN_DUMP_PROMPT_VERSION,
            usage,
            attempts: attempt,
          };
        }

        lastIssues = parsed.error.issues
          .slice(0, 8)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
        console.warn("[paceAI] brain dump output failed validation", { attempt, issues: lastIssues });
        userMessage = `${baseMessage}\n\nYour previous answer did not match the required schema:\n- ${lastIssues.join(
          "\n- "
        )}\nCall the tool again with a corrected, complete answer.`;
      }

      throw new AIError("invalid_output", "AI output did not match the brain dump schema", { issues: lastIssues });
    },
  };
}

function toVendorJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  return jsonSchema;
}
