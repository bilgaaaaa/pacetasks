import type { Task, TaskTiming } from "./task.ts";

// Pending tasks read in this fixed order (before work, then anytime, then after
// work), matching the app's one-list design with no section headers.
export const TIMING_ORDER: TaskTiming[] = ["before_work", "anytime", "after_work"];

export interface TodayTasks {
  pending: Task[];
  done: Task[];
}

// A pending task belongs to "Today" when it has no date, is due today, or is
// overdue; future-dated tasks stay hidden until their day comes.
export function isPendingToday(task: Task, todayKey: string): boolean {
  return task.status === "pending" && (task.due_date === null || task.due_date <= todayKey);
}

// Splits tasks into what the Today list shows: ordered pending tasks, then done
// ones. Shared so the app list and Siri's "today" answer never disagree.
export function selectTodayTasks(tasks: Task[], todayKey: string): TodayTasks {
  const pending = tasks
    .filter((task) => isPendingToday(task, todayKey))
    .sort((a, b) => TIMING_ORDER.indexOf(a.timing) - TIMING_ORDER.indexOf(b.timing));
  const done = tasks.filter((task) => task.status === "done");
  return { pending, done };
}
