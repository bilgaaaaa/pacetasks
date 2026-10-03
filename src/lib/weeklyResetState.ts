import type { ResetItem, ResetOutcome } from "@domain/weeklyReset";

// Pure state for one Weekly Reset run. The items are a snapshot taken at the
// start: decisions change the live task list, and a list that reshuffled under
// the user's finger would make "3 of 12" meaningless.

export type WeeklyResetPhase = "intro" | "reviewing" | "summary";

export interface WeeklyResetSession {
  items: ResetItem[];
  index: number; // the item being decided; equal to items.length once all are decided
  tally: Record<ResetOutcome, number>;
}

const EMPTY_TALLY: Record<ResetOutcome, number> = { scheduled: 0, parked: 0, deleted: 0, kept: 0 };

export function startSession(items: ResetItem[]): WeeklyResetSession {
  return { items, index: 0, tally: { ...EMPTY_TALLY } };
}

// Counts the decision for the current item and moves to the next one.
export function recordDecision(session: WeeklyResetSession, outcome: ResetOutcome): WeeklyResetSession {
  if (session.index >= session.items.length) return session;
  return {
    ...session,
    index: session.index + 1,
    tally: { ...session.tally, [outcome]: session.tally[outcome] + 1 },
  };
}

export function sessionPhase(session: WeeklyResetSession | null): WeeklyResetPhase {
  if (!session) return "intro";
  return session.index >= session.items.length ? "summary" : "reviewing";
}

export function currentItem(session: WeeklyResetSession | null): ResetItem | null {
  return session?.items[session.index] ?? null;
}
