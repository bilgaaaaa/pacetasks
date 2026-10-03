import { daysBetween, toLocalDateKey } from "./dates.ts";
import { ROLLOVER_DESTINATIONS, rolloverPatch } from "./rollover.ts";
import type { RolloverDestination } from "./rollover.ts";
import type { Task } from "./task.ts";
import type { TaskPatch } from "./taskPatch.ts";

// Weekly Reset: once a week the user walks through the tasks that are quietly
// rotting (overdue, postponed again and again, or sitting undated for weeks)
// and decides each one's fate. Deterministic rules, no AI.

export type ResetReason = "overdue" | "postponed_often" | "undated_old";

export const WEEKLY_RESET_POLICY = {
  postponedAtLeast: 2, // moved this often = "repeatedly postponed"
  undatedOlderThanDays: 14, // an undated task this old has been ignored, not forgotten
} as const;

export interface ResetItem {
  task: Task;
  reason: ResetReason;
}

// What the user can decide for a task: move it (the rollover destinations),
// delete it, or keep it exactly as it is.
export const RESET_ACTIONS = [...ROLLOVER_DESTINATIONS, "delete", "keep"] as const;
export type ResetAction = (typeof RESET_ACTIONS)[number];

// How a decision is counted in the closing summary.
export type ResetOutcome = "scheduled" | "parked" | "deleted" | "kept";

// The first reason that applies, most pressing first; null when the task is fine.
// `timeZone` is the phone's zone when called from a server; the app omits it.
function resetReason(task: Task, todayKey: string, timeZone?: string): ResetReason | null {
  if (task.status !== "pending") return null;
  if (task.due_date !== null && task.due_date < todayKey) return "overdue";
  if (task.postponed_count >= WEEKLY_RESET_POLICY.postponedAtLeast) return "postponed_often";
  if (task.due_date === null) {
    const createdKey = toLocalDateKey(new Date(task.created_at), timeZone);
    if (daysBetween(createdKey, todayKey) >= WEEKLY_RESET_POLICY.undatedOlderThanDays) return "undated_old";
  }
  return null;
}

// Every task worth a decision this week, each listed once: overdue first, then
// repeatedly postponed, then long-undated; oldest first within each group.
export function selectResetItems(tasks: Task[], todayKey: string, timeZone?: string): ResetItem[] {
  const reasonOrder: ResetReason[] = ["overdue", "postponed_often", "undated_old"];
  return tasks
    .map((task) => ({ task, reason: resetReason(task, todayKey, timeZone) }))
    .filter((item): item is ResetItem => item.reason !== null)
    .sort(
      (a, b) =>
        reasonOrder.indexOf(a.reason) - reasonOrder.indexOf(b.reason) ||
        (a.task.due_date ?? "").localeCompare(b.task.due_date ?? "") ||
        a.task.created_at.localeCompare(b.task.created_at)
    );
}

// How many items there are for each reason, for the opening summary.
export function countResetReasons(items: ResetItem[]): Record<ResetReason, number> {
  const counts: Record<ResetReason, number> = { overdue: 0, postponed_often: 0, undated_old: 0 };
  for (const item of items) counts[item.reason] += 1;
  return counts;
}

function isDestination(action: ResetAction): action is RolloverDestination {
  return (ROLLOVER_DESTINATIONS as readonly string[]).includes(action);
}

// The change a move decision makes, or null for "delete" and "keep", which
// don't patch the task.
export function resetPatch(task: Task, action: ResetAction, todayKey: string): TaskPatch | null {
  return isDestination(action) ? rolloverPatch(task, action, todayKey) : null;
}

export function resetOutcome(action: ResetAction): ResetOutcome {
  if (action === "delete") return "deleted";
  if (action === "keep") return "kept";
  return action === "someday" ? "parked" : "scheduled";
}
