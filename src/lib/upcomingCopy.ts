import { daysBetween } from "@domain/dates";
import { formatDayLabel } from "./dueLabel";

// UI copy for the Upcoming list (tasks set for a later day). Which tasks belong
// there is decided in @domain/todayTasks; wording lives here.

export const UPCOMING_EYEBROW = "UPCOMING";
export const UPCOMING_TITLE = "Set for a later day";
export const UPCOMING_SUBTITLE = "These wait here and show up on Today when their day comes.";
export const UPCOMING_EMPTY = "Nothing is set for a later day.";
export const MOVE_TO_TODAY_LABEL = "Move to Today";

// The Today footer link: "Upcoming · 3".
export function upcomingLink(count: number): string {
  return `Upcoming · ${count}`;
}

// A day's heading in the list: "Tomorrow · Tue 13 Oct", then just "Thu 15 Oct".
export function upcomingDayHeading(dateKey: string, todayKey: string): string {
  const day = formatDayLabel(dateKey);
  return daysBetween(todayKey, dateKey) === 1 ? `Tomorrow · ${day}` : day;
}

// "1 task" / "3 tasks" beside a day's heading.
export function upcomingDayCount(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}
