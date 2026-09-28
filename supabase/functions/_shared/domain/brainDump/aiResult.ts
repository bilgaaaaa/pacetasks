import { z } from "zod";
import { ENERGY_LEVELS, TASK_PRIORITIES } from "../task.ts";

// The contract an AI provider must return for a brain dump. It is a proposal:
// validated here, then normalized by normalize.ts before anything is saved.
// Bump BRAIN_DUMP_SCHEMA_VERSION whenever this shape changes.
export const BRAIN_DUMP_SCHEMA_VERSION = 1;

export const TASK_CONTEXTS = ["home", "work", "outside", "computer", "phone", "errands"] as const;
export const TIMES_OF_DAY = ["morning", "afternoon", "evening"] as const;
export const DATE_RELATIONS = ["on", "by"] as const;

const MAX_CANDIDATES = 25;

// The words that expressed the date, verbatim ("domani", "before Friday", "yarın").
const dateText = z.string().min(1).max(100);

// Dates are described, never computed, by the model; resolveDate.ts turns them
// into calendar days using the phone's "today".
export const dateExpressionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("relative_day"),
    offsetDays: z.number().int().min(0).max(365), // 0 = today, 1 = tomorrow
    relation: z.enum(DATE_RELATIONS),
    text: dateText,
  }),
  z.object({
    kind: z.literal("weekday"),
    weekday: z.number().int().min(1).max(7), // ISO: 1 = Monday … 7 = Sunday
    relation: z.enum(["on", "by", "next"]),
    text: dateText,
  }),
  z.object({
    kind: z.literal("absolute"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    relation: z.enum(DATE_RELATIONS),
    text: dateText,
  }),
  z.object({
    kind: z.literal("vague"), // "sometime soon", "one of these days"
    text: dateText,
  }),
]);

export const aiTaskCandidateSchema = z.object({
  title: z.string().min(1).max(300),
  sourceSpan: z.string().min(1).max(1000),
  language: z.string().min(2).max(35),
  notes: z.string().max(2000).nullable(),
  when: dateExpressionSchema.nullable(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  timeOfDay: z.enum(TIMES_OF_DAY).nullable(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).nullable(),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  energyRequired: z.enum(ENERGY_LEVELS).nullable(),
  flexible: z.boolean(),
  context: z.array(z.enum(TASK_CONTEXTS)).max(TASK_CONTEXTS.length),
  category: z.string().max(40).nullable(), // checked against CATEGORY_IDS in normalize.ts
  confidence: z.number().min(0).max(1),
  ambiguities: z
    .array(z.object({ field: z.string().max(40), reason: z.string().max(300) }))
    .max(10),
});

export const brainDumpAiResultSchema = z.object({
  schemaVersion: z.literal(BRAIN_DUMP_SCHEMA_VERSION),
  detectedLanguages: z.array(z.string().min(2).max(35)).max(10),
  candidates: z.array(aiTaskCandidateSchema).max(MAX_CANDIDATES),
  unparsedFragments: z.array(z.string().max(1000)).max(20),
});

export type DateExpression = z.infer<typeof dateExpressionSchema>;
export type AiTaskCandidate = z.infer<typeof aiTaskCandidateSchema>;
export type BrainDumpAiResult = z.infer<typeof brainDumpAiResultSchema>;
export type TaskContext = (typeof TASK_CONTEXTS)[number];
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];
