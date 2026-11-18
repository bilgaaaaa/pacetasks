import { addDays, daysBetween, weekdayIndex } from "@domain/dates";
import { formatDueLabel } from "./dueLabel";
import { DueKind, Task } from "./types";
import { localized, msg, t } from "../i18n";

// The "When?" choices in the add-task sheet, turned into the task's
// due_date/due_kind relative to the phone's today. A choice is either one exact
// day or a flexible window ("any day", "this week", "next week").

export const FLEXIBLE_DUE_IDS = ["any", "this_week", "next_week"] as const;
export type FlexibleDue = (typeof FLEXIBLE_DUE_IDS)[number];

export type DueChoice = { kind: "flexible"; when: FlexibleDue } | { kind: "day"; dateKey: string };

export const DEFAULT_DUE_CHOICE: DueChoice = { kind: "flexible", when: "any" };

// `hint` says in a few words what the choice means for the task.
export const FLEXIBLE_DUE_LABELS: Record<FlexibleDue, { label: string; hint: string }> = localized({
  any: { label: msg("Any day"), hint: msg("Stays on Today until it's done") },
  this_week: { label: msg("This week"), hint: msg("Any day up to Sunday") },
  next_week: { label: msg("Next week"), hint: msg("Any day up to the Sunday after") },
});

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

// The choice that shows an existing task's day in the sheet. A deadline that is
// not a week's Sunday (e.g. "by Fri" from Brain Dump) shows as that day.
export function dueChoiceOfTask(task: Pick<Task, "due_date" | "due_kind">, todayKey: string): DueChoice {
  if (!task.due_date) return DEFAULT_DUE_CHOICE;
  if (task.due_kind === "by") {
    if (task.due_date === endOfWeek(todayKey)) return { kind: "flexible", when: "this_week" };
    if (task.due_date === addDays(endOfWeek(todayKey), 7)) return { kind: "flexible", when: "next_week" };
  }
  return { kind: "day", dateKey: task.due_date };
}

export function isSameDueChoice(a: DueChoice, b: DueChoice): boolean {
  if (a.kind === "day" && b.kind === "day") return a.dateKey === b.dateKey;
  return a.kind === "flexible" && b.kind === "flexible" && a.when === b.when;
}

// What the "Added …" confirmation says about when: "for today", "for Thu",
// "for this week"; null for "any day", which needs no mention.
export function dueChoiceSummary(choice: DueChoice, todayKey: string): string | null {
  if (choice.kind === "flexible") {
    if (choice.when === "any") return null;
    return choice.when === "this_week" ? t("for this week") : t("for next week");
  }
  const daysAhead = daysBetween(todayKey, choice.dateKey);
  if (daysAhead === 0) return t("for today");
  if (daysAhead === 1) return t("for tomorrow");
  return t("for {0}", formatDueLabel(choice.dateKey, "on", todayKey));
}

// Short label for the add sheet's day pill: "Any day", "This week", "Today", "Thu", "2 Nov".
export function dueChoiceLabel(choice: DueChoice, todayKey: string): string {
  if (choice.kind === "flexible") return FLEXIBLE_DUE_LABELS[choice.when].label;
  return formatDueLabel(choice.dateKey, "on", todayKey);
}
