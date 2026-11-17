import { daysBetween } from "@domain/dates";
import type { TodayFilter } from "./taskSections";
import { getLocale, localized, msg, t } from "../i18n";

// UI copy for the Today header and filters. Counts come from summarizePending,
// so every number shown is computed from the real pending list.

// Hours at which the greeting changes. The night (before 5) stays "Good evening":
// someone still up at 1 am is ending their day, not starting it.
const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 18;

// The greeting above Today, from the phone's local hour (0-23).
export function greetingForHour(hour: number): string {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) return t("Good morning");
  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) return t("Good afternoon");
  return t("Good evening");
}

// A day key as a local date at noon, so formatting it never slips into the day before or after.
function localNoon(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00`);
}

// The big title over the list: the greeting on today, otherwise which day is shown ("Tomorrow", "Thursday").
export function dayTitle(dayKey: string, todayKey: string, hour: number): string {
  const offset = daysBetween(todayKey, dayKey);
  if (offset === 0) return greetingForHour(hour);
  if (offset === 1) return t("Tomorrow");
  if (offset === -1) return t("Yesterday");
  const weekday = localNoon(dayKey).toLocaleDateString(getLocale(), { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

// The small label over the title: "SUNDAY · OCTOBER 4".
export function dayEyebrow(dayKey: string): string {
  const date = localNoon(dayKey);
  const day = date.toLocaleDateString(getLocale(), { weekday: "long" });
  const month = date.toLocaleDateString(getLocale(), { month: "long", day: "numeric" });
  return `${day} · ${month}`.toUpperCase();
}

// The secondary totals line: "13 tasks · about 343 min".
export function totalsLine(count: number, totalMinutes: number): string {
  if (count === 0) return t("Nothing left for today");
  const tasks = count === 1 ? t("1 task") : t("{0} tasks", count);
  return t("{0} · about {1} min", tasks, totalMinutes);
}

export const TODAY_FILTER_LABELS: Record<TodayFilter, string> = localized({
  all: msg("All"),
  quick: msg("Quick wins"),
  due: msg("Due today"),
});

// The grouping panel's heading, and the name VoiceOver reads for the button that opens it.
export const GROUP_PANEL_TITLE = msg("Group the list");

// Shown in place of the list when a filter leaves nothing.
export function emptyFilterMessage(filter: TodayFilter): string {
  switch (filter) {
    case "quick":
      return t("No quick wins right now. Everything left takes a bit longer.");
    case "due":
      return t("Nothing is due today.");
    case "all":
      return t("Tap “Add a task” below the moment something pops into your head.");
  }
}
