import type { AiTaskCandidate, BrainDumpAiResult } from "../brainDump/aiResult.ts";

// Builds a schema-valid AI candidate for tests; each test overrides only what it is about.
export function makeAiCandidate(overrides: Partial<AiTaskCandidate> = {}): AiTaskCandidate {
  return {
    title: "Buy shampoo",
    sourceSpan: "buy shampoo",
    language: "en",
    notes: null,
    when: null,
    dueTime: null,
    timeOfDay: null,
    estimatedDurationMinutes: null,
    priority: null,
    energyRequired: null,
    flexible: false,
    context: [],
    category: null,
    confidence: 0.95,
    ambiguities: [],
    ...overrides,
  };
}

// Wraps candidates in a complete AI result.
export function makeAiResult(
  candidates: AiTaskCandidate[],
  overrides: Partial<BrainDumpAiResult> = {}
): BrainDumpAiResult {
  return { schemaVersion: 1, detectedLanguages: ["en"], candidates, unparsedFragments: [], ...overrides };
}
