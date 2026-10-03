import { daysBetween, toLocalDateKey } from "@domain/dates";
import type { ResetAction, ResetItem, ResetOutcome, ResetReason } from "@domain/weeklyReset";
import { destinationLabel } from "./rolloverCopy";

// UI copy for Weekly Reset. Rules live in @domain/weeklyReset; wording lives
// here so it can be localized later without touching the logic.

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// One line per kind of task found, for the opening screen; kinds with none are left out.
export function introLines(counts: Record<ResetReason, number>): string[] {
  return [
    counts.overdue > 0 ? `${plural(counts.overdue, "overdue task", "overdue tasks")}` : null,
    counts.postponed_often > 0
      ? `${plural(counts.postponed_often, "task", "tasks")} you keep postponing`
      : null,
    counts.undated_old > 0 ? `${plural(counts.undated_old, "task", "tasks")} sitting without a date` : null,
  ].filter((line): line is string => line !== null);
}

// Why this task is in the reset, with the number that makes it concrete.
export function itemReason(item: ResetItem, todayKey: string): string {
  const { task, reason } = item;
  switch (reason) {
    case "overdue":
      return `${plural(daysBetween(task.due_date as string, todayKey), "day", "days")} overdue`;
    case "postponed_often":
      return `Moved ${task.postponed_count} times`;
    case "undated_old": {
      const weeks = Math.floor(daysBetween(toLocalDateKey(new Date(task.created_at)), todayKey) / 7);
      return `No date for ${plural(weeks, "week", "weeks")}`;
    }
  }
}

export function actionLabel(action: ResetAction): string {
  if (action === "delete") return "Delete";
  if (action === "keep") return "Keep as is";
  return destinationLabel(action);
}

export function progressLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}

const OUTCOME_WORDS: Record<ResetOutcome, string> = {
  scheduled: "scheduled",
  parked: "moved to Someday",
  deleted: "deleted",
  kept: "kept as is",
};

// What the run achieved, e.g. "4 scheduled · 2 moved to Someday · 1 deleted"; outcomes with none are left out.
export function summaryLine(tally: Record<ResetOutcome, number>): string {
  return (Object.keys(OUTCOME_WORDS) as ResetOutcome[])
    .filter((outcome) => tally[outcome] > 0)
    .map((outcome) => `${tally[outcome]} ${OUTCOME_WORDS[outcome]}`)
    .join(" · ");
}
