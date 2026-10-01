import type { BrainDumpAiResult } from "../../domain/brainDump/aiResult.ts";
import type { AIProviderName, TokenUsage } from "./LLMClient.ts";

// "rules" is PaceTasks' own rule-based parser: no vendor, no model, no cost.
export const RULES_PROVIDER_NAME = "rules";

// Where an interpretation came from: an AI vendor or the built-in rules.
export type InterpretationProvider = AIProviderName | typeof RULES_PROVIDER_NAME;

export interface BrainDumpInterpretationRequest {
  text: string;
  todayKey: string; // phone's local day
  timeZone: string;
  localeHint: string | null;
}

// An AI answer plus what produced it, stored with each session for auditing
// and for comparing prompts/models later.
export interface AIInterpretation<T> {
  result: T;
  provider: InterpretationProvider;
  model: string;
  promptVersion: string;
  usage: TokenUsage;
  attempts: number;
}

// What PaceTasks asks of AI, independent of vendor. Every method returns a
// validated proposal; nothing here writes to the database.
// recommendNextTask, breakDownTask and planDay join this interface as each
// feature ships, each with its own versioned prompt and output schema.
export interface AIProvider {
  parseBrainDump(request: BrainDumpInterpretationRequest): Promise<AIInterpretation<BrainDumpAiResult>>;
}
