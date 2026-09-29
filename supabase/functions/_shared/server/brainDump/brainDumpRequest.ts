import { z } from "zod";
import { BRAIN_DUMP_MAX_TEXT_LENGTH } from "../../domain/brainDump/limits.ts";
import { isValidTimeZone } from "../../domain/dates.ts";

// Where the brain dump came from; decides the tasks' `source` and lets Siri
// and Shortcuts share this endpoint with the app.
export const BRAIN_DUMP_CHANNELS = ["app", "siri", "shortcut"] as const;
export type BrainDumpChannel = (typeof BRAIN_DUMP_CHANNELS)[number];

// "propose" always returns a proposal for review; "auto" also creates the tasks
// when the review policy allows it and the user enabled auto-create.
export const BRAIN_DUMP_MODES = ["propose", "auto"] as const;

// The HTTP contract of POST /functions/v1/brain-dump.
export const brainDumpRequestSchema = z.object({
  text: z.string().trim().min(1, "Text is empty").max(BRAIN_DUMP_MAX_TEXT_LENGTH),
  timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
  locale: z.string().max(35).nullish().transform((value) => value ?? null),
  channel: z.enum(BRAIN_DUMP_CHANNELS).default("app"),
  mode: z.enum(BRAIN_DUMP_MODES).default("propose"),
});

export type BrainDumpRequest = z.infer<typeof brainDumpRequestSchema>;
