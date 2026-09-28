import type { BrainDumpAiResult } from "../../domain/brainDump/aiResult.ts";

// A schema-valid AI answer for "domani devo chiamare il veterinario per Bruno e comprare lo shampoo".
export const SAMPLE_AI_RESULT: BrainDumpAiResult = {
  schemaVersion: 1,
  detectedLanguages: ["it"],
  candidates: [
    {
      title: "Chiamare il veterinario per Bruno",
      sourceSpan: "domani devo chiamare il veterinario per Bruno",
      language: "it",
      notes: null,
      when: { kind: "relative_day", offsetDays: 1, relation: "on", text: "domani" },
      dueTime: null,
      timeOfDay: null,
      estimatedDurationMinutes: 10,
      priority: null,
      energyRequired: "low",
      flexible: false,
      context: ["phone"],
      category: "personal",
      confidence: 0.93,
      ambiguities: [],
    },
    {
      title: "Comprare lo shampoo",
      sourceSpan: "comprare lo shampoo",
      language: "it",
      notes: null,
      when: null,
      dueTime: null,
      timeOfDay: null,
      estimatedDurationMinutes: 15,
      priority: null,
      energyRequired: "low",
      flexible: false,
      context: ["errands"],
      category: "shopping",
      confidence: 0.9,
      ambiguities: [],
    },
  ],
  unparsedFragments: [],
};
