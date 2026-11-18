import { daysBetween, toLocalDateKey } from "@domain/dates";
import type { ResetAction, ResetItem, ResetOutcome, ResetReason } from "@domain/weeklyReset";
import { destinationLabel } from "./rolloverCopy";
import { msg, t, tn } from "../i18n";

// UI copy for Weekly Reset. Rules live in @domain/weeklyReset; wording lives
// here so it can be localized later without touching the logic.

// One line per kind of task found, for the opening screen; kinds with none are left out.
export function introLines(counts: Record<ResetReason, number>): string[] {
  return [
    counts.overdue > 0 ? tn(counts.overdue, "1 overdue task", "{0} overdue tasks") : null,
    counts.postponed_often > 0
      ? tn(counts.postponed_often, "1 task you keep postponing", "{0} tasks you keep postponing")
      : null,
    counts.undated_old > 0
      ? tn(counts.undated_old, "1 task sitting without a date", "{0} tasks sitting without a date")
      : null,
  ].filter((line): line is string => line !== null);
}

// Why this task is in the reset, with the number that makes it concrete.
export function itemReason(item: ResetItem, todayKey: string): string {
  const { task, reason } = item;
  switch (reason) {
    case "overdue":
      return tn(daysBetween(task.due_date as string, todayKey), "1 day overdue", "{0} days overdue");
    case "postponed_often":
      return t("Moved {0} times", task.postponed_count);
    case "undated_old": {
      const weeks = Math.floor(daysBetween(toLocalDateKey(new Date(task.created_at)), todayKey) / 7);
      return tn(weeks, "No date for 1 week", "No date for {0} weeks");
    }
  }
}

export function actionLabel(action: ResetAction): string {
  if (action === "delete") return t("Delete");
  if (action === "keep") return t("Keep as is");
  return destinationLabel(action);
}

export function progressLabel(index: number, total: number): string {
  return t("{0} of {1}", index + 1, total);
}

// How each outcome reads with its count; the count is {0}.
const OUTCOME_COUNTS: Record<ResetOutcome, string> = {
  scheduled: msg("{0} scheduled"),
  parked: msg("{0} moved to Someday"),
  deleted: msg("{0} deleted"),
  kept: msg("{0} kept as is"),
};

// What the run achieved, e.g. "4 scheduled · 2 moved to Someday · 1 deleted"; outcomes with none are left out.
export function summaryLine(tally: Record<ResetOutcome, number>): string {
  return (Object.keys(OUTCOME_COUNTS) as ResetOutcome[])
    .filter((outcome) => tally[outcome] > 0)
    .map((outcome) => t(OUTCOME_COUNTS[outcome], tally[outcome]))
    .join(" · ");
}
