import { daysBetween } from "@domain/dates";
import { DueKind } from "./types";
import { localized, msg, t } from "../i18n";

const WEEKDAY_SHORT = localized([msg("Sun"), msg("Mon"), msg("Tue"), msg("Wed"), msg("Thu"), msg("Fri"), msg("Sat")]);
const MONTH_SHORT = localized([msg("Jan"), msg("Feb"), msg("Mar"), msg("Apr"), msg("May"), msg("Jun"), msg("Jul"), msg("Aug"), msg("Sep"), msg("Oct"), msg("Nov"), msg("Dec")]);

// Short, human label for a task's due day relative to the phone's today:
// "Today", "Tomorrow", "Fri", "2 Oct", "by Fri", or "Overdue".
export function formatDueLabel(dueDate: string, dueKind: DueKind | null, todayKey: string): string {
  const daysAhead = daysBetween(todayKey, dueDate);
  if (daysAhead < 0) return t("Overdue");

  const date = new Date(`${dueDate}T00:00:00Z`);
  const day =
    daysAhead === 0
      ? t("Today")
      : daysAhead === 1
      ? t("Tomorrow")
      : daysAhead < 7
      ? WEEKDAY_SHORT[date.getUTCDay()]
      : `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;

  if (dueKind !== "by") return day;
  if (daysAhead === 0) return t("by today");
  if (daysAhead === 1) return t("by tomorrow");
  return t("by {0}", day);
}

// A calendar day spelled out for a list of past days: "Mon 12 Oct".
export function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return `${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}
