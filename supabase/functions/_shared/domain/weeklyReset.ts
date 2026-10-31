import { daysBetween, isValidDateKey, startOfWeek, toLocalDateKey } from "./dates.ts";
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

// The tasks the user chose to keep as they are, and the week (its Monday) they
// said so in: a kept task is not offered again until the next week starts.
export interface KeptResetTasks {
  weekStart: string;
  taskIds: string[];
}

export interface ResetSelectionOptions {
  keptIds?: readonly string[]; // tasks already kept this week (see keptIdsThisWeek)
  timeZone?: string; // the phone's zone when called from a server; the app omits it
}

// The first reason that applies, most pressing first; null when the task is fine.
function resetReason(task: Task, todayKey: string, timeZone?: string): ResetReason | null {
  if (task.status !== "pending") return null;
  if (task.due_date !== null && task.due_date < todayKey) return "overdue";
  // A task moved to a future day has just been dealt with; it comes back once that day arrives.
  const isScheduledAhead = task.due_date !== null && task.due_date > todayKey;
  if (!isScheduledAhead && task.postponed_count >= WEEKLY_RESET_POLICY.postponedAtLeast) return "postponed_often";
  if (task.due_date === null) {
    const createdKey = toLocalDateKey(new Date(task.created_at), timeZone);
    if (daysBetween(createdKey, todayKey) >= WEEKLY_RESET_POLICY.undatedOlderThanDays) return "undated_old";
  }
  return null;
}

// Every task worth a decision this week, each listed once: overdue first, then
// repeatedly postponed (and not already scheduled ahead), then long-undated;
// oldest first within each group. Tasks already kept this week are left out.
export function selectResetItems(
  tasks: Task[],
  todayKey: string,
  { keptIds = [], timeZone }: ResetSelectionOptions = {}
): ResetItem[] {
  const reasonOrder: ResetReason[] = ["overdue", "postponed_often", "undated_old"];
  const kept = new Set(keptIds);
  return tasks
    .filter((task) => !kept.has(task.id))
    .map((task) => ({ task, reason: resetReason(task, todayKey, timeZone) }))
    .filter((item): item is ResetItem => item.reason !== null)
    .sort(
      (a, b) =>
        reasonOrder.indexOf(a.reason) - reasonOrder.indexOf(b.reason) ||
        (a.task.due_date ?? "").localeCompare(b.task.due_date ?? "") ||
        a.task.created_at.localeCompare(b.task.created_at)
    );
}

// The ids kept during the week `todayKey` falls in; a record from an earlier week no longer counts.
export function keptIdsThisWeek(kept: KeptResetTasks | null, todayKey: string): string[] {
  return kept?.weekStart === startOfWeek(todayKey) ? kept.taskIds : [];
}

// The record after keeping one more task. It starts again from this week's
// ids alone, so earlier weeks never pile up.
export function keepResetTask(kept: KeptResetTasks | null, taskId: string, todayKey: string): KeptResetTasks {
  const taskIds = keptIdsThisWeek(kept, todayKey);
  return {
    weekStart: startOfWeek(todayKey),
    taskIds: taskIds.includes(taskId) ? taskIds : [...taskIds, taskId],
  };
}

// Reads a stored record back; anything that is not one (missing, damaged, an
// older shape) counts as nothing kept.
export function parseKeptResetTasks(raw: string | null): KeptResetTasks | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const { weekStart, taskIds } = data as Record<string, unknown>;
    if (typeof weekStart !== "string" || !isValidDateKey(weekStart) || !Array.isArray(taskIds)) return null;
    return { weekStart, taskIds: taskIds.filter((id): id is string => typeof id === "string") };
  } catch {
    return null;
  }
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
