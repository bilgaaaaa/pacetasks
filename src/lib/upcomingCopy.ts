import { daysBetween } from "@domain/dates";
import { formatDayLabel } from "./dueLabel";
import { msg, t } from "../i18n";

// UI copy for the Upcoming list (tasks set for a later day). Which tasks belong
// there is decided in @domain/todayTasks; wording lives here.

export const UPCOMING_EYEBROW = "UPCOMING";
export const UPCOMING_TITLE = msg("Set for a later day");
export const UPCOMING_SUBTITLE = msg("These wait here and show up on Today when their day comes.");
export const UPCOMING_EMPTY = msg("Nothing is set for a later day.");
export const MOVE_TO_TODAY_LABEL = msg("Move to Today");

// The Today footer link: "Upcoming · 3".
export function upcomingLink(count: number): string {
  return t("Upcoming · {0}", count);
}

// A day's heading in the list: "Tomorrow · Tue 13 Oct", then just "Thu 15 Oct".
export function upcomingDayHeading(dateKey: string, todayKey: string): string {
  const day = formatDayLabel(dateKey);
  return daysBetween(todayKey, dateKey) === 1 ? t("Tomorrow · {0}", day) : day;
}

// "1 task" / "3 tasks" beside a day's heading.
export function upcomingDayCount(count: number): string {
  return count === 1 ? t("1 task") : t("{0} tasks", count);
}
