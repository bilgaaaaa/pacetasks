import { brainDumpAiResultSchema } from "../../domain/brainDump/aiResult.ts";
import type { BrainDumpAiResult } from "../../domain/brainDump/aiResult.ts";
import { parseBrainDumpWithRules, RULES_PARSER_VERSION } from "../../domain/brainDump/rulesParser.ts";
import { RULES_PROVIDER_NAME } from "./AIProvider.ts";
import type { AIInterpretation, AIProvider, BrainDumpInterpretationRequest } from "./AIProvider.ts";

// The free AIProvider: PaceTasks' own rule-based parser instead of an AI model.
// It is held to the same contract as a model (schema-validated output, the same
// AIInterpretation), so everything after it runs unchanged. Uses no tokens.
export function createRulesAIProvider(): AIProvider {
  return {
    parseBrainDump(request: BrainDumpInterpretationRequest): Promise<AIInterpretation<BrainDumpAiResult>> {
      // Same contract check as an AI provider: an invalid shape fails here, not in normalize.
      const result = brainDumpAiResultSchema.parse(parseBrainDumpWithRules(request.text));
      console.log(
        `[rulesAI] ${result.candidates.length} candidate(s), ${result.unparsedFragments.length} unparsed`
      );
      return Promise.resolve({
        result,
        provider: RULES_PROVIDER_NAME,
        model: RULES_PARSER_VERSION,
        promptVersion: RULES_PARSER_VERSION,
        usage: { inputTokens: 0, outputTokens: 0 },
        attempts: 1,
      });
    },
  };
}
