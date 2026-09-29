import { daysBetween } from "@domain/dates";
import { DueKind } from "./types";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Short, human label for a task's due day relative to the phone's today:
// "Today", "Tomorrow", "Fri", "2 Oct", "by Fri", or "Overdue".
export function formatDueLabel(dueDate: string, dueKind: DueKind | null, todayKey: string): string {
  const daysAhead = daysBetween(todayKey, dueDate);
  if (daysAhead < 0) return "Overdue";

  const date = new Date(`${dueDate}T00:00:00Z`);
  const day =
    daysAhead === 0
      ? "Today"
      : daysAhead === 1
      ? "Tomorrow"
      : daysAhead < 7
      ? WEEKDAY_SHORT[date.getUTCDay()]
      : `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;

  return dueKind === "by" ? `by ${day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day}` : day;
}
