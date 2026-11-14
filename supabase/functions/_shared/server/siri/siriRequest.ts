import { z } from "zod";
import { BRAIN_DUMP_MAX_TEXT_LENGTH } from "../../domain/brainDump/limits.ts";
import { isValidTimeZone } from "../../domain/dates.ts";

// What Siri can ask PaceTasks: add tasks by voice, what to do next, what is on today.
export const SIRI_ACTIONS = ["add", "next", "today"] as const;
export type SiriAction = (typeof SIRI_ACTIONS)[number];

// The HTTP contract of POST /functions/v1/siri, sent by the iPhone's App Intents.
export const siriRequestSchema = z
  .object({
    action: z.enum(SIRI_ACTIONS),
    text: z.string().trim().max(BRAIN_DUMP_MAX_TEXT_LENGTH).nullish(),
    timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
    locale: z.string().max(35).nullish().transform((value) => value ?? null),
    channel: z.enum(["siri", "shortcut"]).default("siri"),
  })
  .refine((request) => request.action !== "add" || Boolean(request.text), {
    message: "Adding by voice needs text",
    path: ["text"],
  });

export type SiriRequest = z.infer<typeof siriRequestSchema>;

// Every answer carries what Siri should say, even a failure, so the phone never composes text.
export const SIRI_OUTCOMES = ["ok", "pro_required", "quota_exceeded", "unauthorized", "failed"] as const;
export type SiriOutcome = (typeof SIRI_OUTCOMES)[number];

export interface SiriReply {
  action: SiriAction | null; // null when the request itself could not be read
  outcome: SiriOutcome;
  speech: string;
  taskIds: string[];
}
