import { addDays, weekdayIndex } from "@domain/dates";
import { GRID_WEEKDAYS } from "./dayPicker";
import { Task } from "./types";

export interface WeekDay {
  key: string; // "YYYY-MM-DD"
  weekday: string; // "Mon"
  dayOfMonth: number;
  isToday: boolean;
  dueCount: number; // pending tasks due on this exact day
}

// The Monday-to-Sunday week around `todayKey` for the Today screen's day strip
// (the same week as "This week" in the add sheet and the month grid), with how
// many pending tasks are due on each day. Pure calendar math on date keys.
export function buildWeek(todayKey: string, tasks: Pick<Task, "status" | "due_date">[]): WeekDay[] {
  const daysSinceMonday = (weekdayIndex(todayKey) + 6) % 7;
  const monday = addDays(todayKey, -daysSinceMonday);
  const dueByDay = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "pending" && task.due_date) {
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
    };
  });
}
