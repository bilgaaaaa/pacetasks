import { addDays, startOfWeek } from "@domain/dates";
import { GRID_WEEKDAYS } from "./dayPicker";
import { Task } from "./types";

export interface WeekDay {
  key: string; // "YYYY-MM-DD"
  weekday: string; // "Mon"
  dayOfMonth: number;
  isToday: boolean;
  isSelected: boolean; // the day the Today screen is showing
  dueCount: number; // pending tasks dated that day: what the dot stands for
}

// The Monday-to-Sunday week around `selectedKey` for the Today screen's day strip (the same weeks as
// "This week" in the add sheet and the month grid), with how many pending tasks are dated each day.
// Every day can be opened from the strip, so the dot simply counts what is dated there. Pure calendar math on date keys.
export function buildWeek(
  todayKey: string,
  tasks: Pick<Task, "status" | "due_date">[],
  selectedKey: string = todayKey
): WeekDay[] {
  const monday = startOfWeek(selectedKey);
  const dueByDay = new Map<string, number>();
  for (const task of tasks) {
    if (task.status !== "pending" || !task.due_date) continue;
    dueByDay.set(task.due_date, (dueByDay.get(task.due_date) ?? 0) + 1);
  }
  return GRID_WEEKDAYS.map((weekday, index) => {
    const key = addDays(monday, index);
    return {
      key,
      weekday,
      dayOfMonth: Number(key.slice(8, 10)),
      isToday: key === todayKey,
      isSelected: key === selectedKey,
      dueCount: dueByDay.get(key) ?? 0,
    };
  });
}
