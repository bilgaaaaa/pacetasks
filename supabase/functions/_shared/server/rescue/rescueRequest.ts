import { z } from "zod";
import { isValidTimeZone } from "../../domain/dates.ts";
import type { RescueReason } from "../../domain/rescue.ts";
import { ROLLOVER_DESTINATIONS } from "../../domain/rollover.ts";
import type { RolloverDestination } from "../../domain/rollover.ts";

// The HTTP contract of POST /functions/v1/rescue: Rescue my day for apps that don't
// carry the shared domain code (PaceTasks for Mac). The iPhone app plans the same
// rescue on the phone with the same domain.
const MAX_MOVES = 100; // far beyond a real day

export const rescueRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
  }),
  z.object({
    action: z.literal("apply"),
    timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
    moves: z
      .array(z.object({ taskId: z.string().uuid(), destination: z.enum(ROLLOVER_DESTINATIONS) }))
      .min(1)
      .max(MAX_MOVES),
  }),
]);

export type RescueRequest = z.infer<typeof rescueRequestSchema>;

// One task on the card, with what the server would do with it.
export interface RescueProposalReply {
  taskId: string;
  title: string;
  destination: RolloverDestination; // "today" keeps it
  reason: RescueReason;
  minutes: number; // at the user's learned pace
}

export type RescueReply =
  | {
      action: "plan";
      behind: boolean;
      minutesLeft: number;
      minutesPlanned: number;
      proposals: RescueProposalReply[]; // tasks to move first, then the ones kept
    }
  | { action: "apply"; moved: number };
