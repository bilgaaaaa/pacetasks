import { addDays, startOfWeek } from "@domain/dates";
import { isUpcoming } from "@domain/todayTasks";
import { GRID_WEEKDAYS } from "./dayPicker";
import { Task } from "./types";

export interface WeekDay {
  key: string; // "YYYY-MM-DD"
  weekday: string; // "Mon"
  dayOfMonth: number;
  isToday: boolean;
  dueCount: number; // what the dot stands for: see buildWeek
  opensUpcoming: boolean; // a later day with tasks waiting in the Upcoming list
}

// The Monday-to-Sunday week around `todayKey` for the Today screen's day strip
// (the same week as "This week" in the add sheet and the month grid), with how
// many pending tasks are due on each day. Up to today that is every pending task
// dated that day; a later day counts only what waits in the Upcoming list
// (isUpcoming), because a "by" deadline is already on Today and a tap on that
// day would open an empty list. Pure calendar math on date keys.
export function buildWeek(todayKey: string, tasks: Pick<Task, "status" | "due_date" | "due_kind">[]): WeekDay[] {
  const monday = startOfWeek(todayKey);
  const dueByDay = new Map<string, number>();
  for (const task of tasks) {
    if (task.status !== "pending" || !task.due_date) continue;
    if (task.due_date <= todayKey || isUpcoming(task, todayKey)) {
      dueByDay.set(task.due_date, (dueByDay.get(task.due_date) ?? 0) + 1);
    }
  }
  return GRID_WEEKDAYS.map((weekday, index) => {
    const key = addDays(monday, index);
    return {
      key,
      weekday,
      dayOfMonth: Number(key.slice(8, 10)),
      isToday: key === todayKey,
      dueCount: dueByDay.get(key) ?? 0,
      opensUpcoming: key > todayKey && dueByDay.has(key),
    };
  });
}
