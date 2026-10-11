import type { Task, TaskTiming } from "./task.ts";

// Pending tasks read in this fixed order (before work, then anytime, then after
// work), matching the app's one-list design with no section headers.
export const TIMING_ORDER: TaskTiming[] = ["before_work", "anytime", "after_work"];

export interface TodayTasks {
  pending: Task[];
  done: Task[];
}

// A pending task belongs to "Today" when it has no date, is due today or overdue,
// or has a deadline ("by"): a deadline task can be done on any day before it. A
// task set for one exact future day ("on") stays hidden until that day comes.
export function isPendingToday(task: Task, todayKey: string): boolean {
  if (task.status !== "pending") return false;
  return task.due_date === null || task.due_kind === "by" || task.due_date <= todayKey;
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

// Parked "someday" tasks, in the list's own order (newest first). They never
// appear on Today; the Someday list is the only place they show.
export function selectSomedayTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.status === "someday");
}

// One later day and the tasks set for it.
export interface UpcomingDay {
  dateKey: string; // "YYYY-MM-DD"
  tasks: Task[];
}

// A pending task set for one exact later day: exactly the tasks isPendingToday
// hides, so every pending task is either on Today or in the Upcoming list.
export function isUpcoming(task: Task, todayKey: string): boolean {
  return task.status === "pending" && !isPendingToday(task, todayKey);
}

// The tasks waiting for a later day, nearest day first and in Today's timing
// order within a day. The Upcoming list is the only place they show until then.
export function selectUpcomingTasks(tasks: Task[], todayKey: string): Task[] {
  return tasks
    .filter((task) => isUpcoming(task, todayKey))
    .sort(
      (a, b) =>
        (a.due_date as string).localeCompare(b.due_date as string) ||
        TIMING_ORDER.indexOf(a.timing) - TIMING_ORDER.indexOf(b.timing)
    );
}

// Groups upcoming tasks (already ordered by selectUpcomingTasks) under their day.
export function groupUpcomingByDay(upcoming: Task[]): UpcomingDay[] {
  const days: UpcomingDay[] = [];
  for (const task of upcoming) {
    const dateKey = task.due_date as string;
    const last = days[days.length - 1];
    if (last?.dateKey === dateKey) last.tasks.push(task);
    else days.push({ dateKey, tasks: [task] });
  }
  return days;
}
