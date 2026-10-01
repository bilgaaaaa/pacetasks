import { addDays, nextWeekendDay } from "./dates.ts";
import type { Task } from "./task.ts";
import { PARK_PATCH, reschedulePatch } from "./taskPatch.ts";
import type { TaskPatch } from "./taskPatch.ts";

// The "I didn't do it" rollover: instead of yesterday's unfinished tasks piling
// onto today as guilt, PaceTasks proposes where each one should go and the user
// accepts in one tap. Deterministic rules, no AI.

export const ROLLOVER_DESTINATIONS = ["today", "tomorrow", "weekend", "someday"] as const;
export type RolloverDestination = (typeof ROLLOVER_DESTINATIONS)[number];

// Why a destination was proposed, so the UI can say it in a few words.
export type RolloverReason =
  | "deadline_passed"
  | "high_priority"
  | "postponed_often"
  | "maybe"
  | "fits_today"
  | "today_full";

export const ROLLOVER_POLICY = {
  todayBudgetMinutes: 60, // most leftover work today takes on; the rest waits for tomorrow
  somedayAfterPostponements: 3, // a task moved this often is probably not happening soon
} as const;

export interface RolloverProposal {
  task: Task;
  destination: RolloverDestination;
  reason: RolloverReason;
}

// A task was left unfinished when it is still pending and its day has passed.
// Undated tasks never count: they live on Today until done.
export function isUnfinished(task: Task, todayKey: string): boolean {
  return task.status === "pending" && task.due_date !== null && task.due_date < todayKey;
}

// Destinations that don't depend on how full today is; null means "decide by budget".
function fixedDestination(task: Task): Pick<RolloverProposal, "destination" | "reason"> | null {
  if (task.due_kind === "by") return { destination: "today", reason: "deadline_passed" };
  if (task.priority === "high") return { destination: "today", reason: "high_priority" };
  if (task.postponed_count >= ROLLOVER_POLICY.somedayAfterPostponements) {
    return { destination: "someday", reason: "postponed_often" };
  }
  if (task.flexible) return { destination: "weekend", reason: "maybe" };
  return null;
}

// Proposes a destination for every unfinished task, oldest first. Missed
// deadlines and high-priority tasks always come to today; ordinary tasks fill
// what is left of today's leftover budget and the rest move to tomorrow.
export function proposeRollover(tasks: Task[], todayKey: string): RolloverProposal[] {
  const unfinished = tasks
    .filter((task) => isUnfinished(task, todayKey))
    .sort(
      (a, b) =>
        (a.due_date as string).localeCompare(b.due_date as string) || a.created_at.localeCompare(b.created_at)
    );

  const fixed = new Map(unfinished.map((task) => [task.id, fixedDestination(task)] as const));
  let budgetMinutes = ROLLOVER_POLICY.todayBudgetMinutes;
  for (const task of unfinished) {
    if (fixed.get(task.id)?.destination === "today") budgetMinutes -= task.estimated_minutes;
  }

  return unfinished.map((task) => {
    const decided = fixed.get(task.id);
    if (decided) return { task, ...decided };
    if (task.estimated_minutes <= budgetMinutes) {
      budgetMinutes -= task.estimated_minutes;
      return { task, destination: "today", reason: "fits_today" };
    }
    return { task, destination: "tomorrow", reason: "today_full" };
  });
}

// The change that sends a task to a destination, relative to the phone's today.
export function rolloverPatch(task: Task, destination: RolloverDestination, todayKey: string): TaskPatch {
  switch (destination) {
    case "today":
      return reschedulePatch(task, todayKey);
    case "tomorrow":
      return reschedulePatch(task, addDays(todayKey, 1));
    case "weekend":
      return reschedulePatch(task, nextWeekendDay(todayKey));
    case "someday":
      return PARK_PATCH;
  }
}
