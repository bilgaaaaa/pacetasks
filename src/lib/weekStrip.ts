import { addDays } from "@domain/dates";
import { Task } from "./types";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeekDay {
  key: string; // "YYYY-MM-DD"
  weekday: string; // "Sun"
  dayOfMonth: number;
  isToday: boolean;
  dueCount: number; // pending tasks due on this exact day
}

// The Sunday-to-Saturday week around `todayKey` for the Today screen's day
// strip, with how many pending tasks are due on each day. Pure calendar math
// on date keys, so it ignores time zones and DST.
export function buildWeek(todayKey: string, tasks: Pick<Task, "status" | "due_date">[]): WeekDay[] {
  const todayIndex = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const sunday = addDays(todayKey, -todayIndex);
  const dueByDay = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "pending" && task.due_date) {
      dueByDay.set(task.due_date, (dueByDay.get(task.due_date) ?? 0) + 1);
    }
  }
  return WEEKDAY_SHORT.map((weekday, index) => {
    const key = addDays(sunday, index);
    return {
      key,
      weekday,
      dayOfMonth: Number(key.slice(8, 10)),
      isToday: key === todayKey,
      dueCount: dueByDay.get(key) ?? 0,
    };
  });
}
