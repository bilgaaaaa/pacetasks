import { toLocalDateKey } from "@domain/dates";
import { selectTodayTasks, TIMING_ORDER, TodayTasks } from "@domain/todayTasks";
import { Task } from "./types";

// What the Today screen lists for the day it shows. Today is the usual Today list; a later day lists the tasks
// set for it, exact day or deadline, so it can be planned; an earlier day lists only what was finished on it,
// because its unfinished tasks already wait on Today.
export function selectDayTasks(tasks: Task[], dayKey: string, todayKey: string): TodayTasks {
  const done = tasks.filter(
    (task) => task.status === "done" && task.completed_at !== null && toLocalDateKey(new Date(task.completed_at)) === dayKey
  );
  if (dayKey === todayKey) return { pending: selectTodayTasks(tasks, todayKey).pending, done };
  const pending =
    dayKey > todayKey
      ? tasks
          .filter((task) => task.status === "pending" && task.due_date === dayKey)
          .sort((a, b) => TIMING_ORDER.indexOf(a.timing) - TIMING_ORDER.indexOf(b.timing))
      : [];
  return { pending, done };
}

// The day a task added from this day's view is set for: a later day plans for that day, today and earlier days
// keep the usual "any day" default.
export function plannedDayKey(dayKey: string, todayKey: string): string | null {
  return dayKey > todayKey ? dayKey : null;
}
