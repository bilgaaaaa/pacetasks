import { getCategory } from "./categories";
import { formatDueLabel } from "./dueLabel";
import { Task } from "./types";

// UI copy for One Thing mode. The choice of task comes from @domain/doNow;
// wording lives here so it can be localized later without touching the logic.

// One calm line under the task's name, e.g. "~12 min · Today · Health".
export function oneThingMeta(task: Task, todayKey: string): string {
  return [
    `~${task.estimated_minutes} min`,
    task.due_date ? formatDueLabel(task.due_date, task.due_kind, todayKey) : null,
    task.category ? getCategory(task.category).label : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// What waits behind the current task, e.g. "3 more after this".
export function remainingLabel(remainingCount: number): string {
  return remainingCount === 0 ? "This is the last one" : `${remainingCount} more after this`;
}

// Shown when there is no task to offer: either everything was passed on, or the day is clear.
export function oneThingEmptyMessage(skippedCount: number): string {
  return skippedCount > 0
    ? "You've passed on everything for now."
    : "Nothing you can start right now. Enjoy the free time.";
}
