import { addDays, weekdayIndex } from "@domain/dates";
import { formatDueLabel } from "./dueLabel";
import { DueKind } from "./types";

// The "When?" choices in the add-task sheet, turned into the task's
// due_date/due_kind relative to the phone's today. A choice is either one exact
// day or a flexible window ("any day", "this week", "next week").

export const FLEXIBLE_DUE_IDS = ["any", "this_week", "next_week"] as const;
export type FlexibleDue = (typeof FLEXIBLE_DUE_IDS)[number];

export type DueChoice = { kind: "flexible"; when: FlexibleDue } | { kind: "day"; dateKey: string };

export const DEFAULT_DUE_CHOICE: DueChoice = { kind: "flexible", when: "any" };

// `hint` says in a few words what the choice means for the task.
export const FLEXIBLE_DUE_LABELS: Record<FlexibleDue, { label: string; hint: string }> = {
  any: { label: "Any day", hint: "Stays on Today until it's done" },
  this_week: { label: "This week", hint: "Any day up to Sunday" },
  next_week: { label: "Next week", hint: "Any day up to the Sunday after" },
};

export interface ResolvedDue {
  due_date: string | null;
  due_kind: DueKind | null;
}

// A week runs Monday to Sunday: its last day is the coming Sunday, or today on a Sunday.
function endOfWeek(todayKey: string): string {
  return addDays(todayKey, (7 - weekdayIndex(todayKey)) % 7);
}

// An exact day is a task for that day ("on"); a week is a deadline ("by") on its
// Sunday, so the task can be done on any day before it.
export function resolveDueChoice(choice: DueChoice, todayKey: string): ResolvedDue {
  if (choice.kind === "day") return { due_date: choice.dateKey, due_kind: "on" };
  switch (choice.when) {
    case "any":
      return { due_date: null, due_kind: null };
    case "this_week":
      return { due_date: endOfWeek(todayKey), due_kind: "by" };
    case "next_week":
      return { due_date: addDays(endOfWeek(todayKey), 7), due_kind: "by" };
  }
}

export function isSameDueChoice(a: DueChoice, b: DueChoice): boolean {
  if (a.kind === "day" && b.kind === "day") return a.dateKey === b.dateKey;
  return a.kind === "flexible" && b.kind === "flexible" && a.when === b.when;
}

// What the "Added …" confirmation says about when: "for today", "for Thu",
// "for this week"; null for "any day", which needs no mention.
export function dueChoiceSummary(choice: DueChoice, todayKey: string): string | null {
  if (choice.kind === "flexible") {
    return choice.when === "any" ? null : `for ${FLEXIBLE_DUE_LABELS[choice.when].label.toLowerCase()}`;
  }
  const label = formatDueLabel(choice.dateKey, "on", todayKey);
  return `for ${label === "Today" || label === "Tomorrow" ? label.toLowerCase() : label}`;
}
