import { daysBetween, toLocalDateKey } from "@domain/dates";
import { TaskReminderMoment } from "@domain/reminders";
import { formatDueLabel } from "./dueLabel";
import { Task } from "./types";
import { msg, t } from "../i18n";

// Wording for reminders: the notifications themselves, the add sheet's
// reminder choices, and the Settings section.

export interface ReminderText {
  title: string;
  body: string;
}

const minutesLabel = (minutes: number) => t("{0} min", minutes);

// "14:45" for a Date, in the phone's local time.
export function formatClockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// The daily check-in: says what is really left, and points at the easiest way in.
export function checkInCopy(open: Task[]): ReminderText {
  const quickest = open.reduce((best, task) => (task.estimated_minutes < best.estimated_minutes ? task : best));
  if (open.length === 1) {
    return { title: t("One thing left today"), body: t("{0}, about {1}.", quickest.title, minutesLabel(quickest.estimated_minutes)) };
  }
  return {
    title: t("{0} things left today", open.length),
    body: t("The quickest is {0}, about {1}.", quickest.title, minutesLabel(quickest.estimated_minutes)),
  };
}

// A task's own reminder: "Starts in 10 minutes, at 18:30." or "Starting now, about 15 min."
export function taskReminderCopy(
  task: Pick<Task, "title" | "estimated_minutes">,
  moment: Pick<TaskReminderMoment, "fireAt" | "startsAt">
): ReminderText {
  const leadMinutes = Math.round((moment.startsAt.getTime() - moment.fireAt.getTime()) / 60_000);
  if (leadMinutes === 0) {
    return { title: task.title, body: t("Starting now, about {0}.", minutesLabel(task.estimated_minutes)) };
  }
  const lead = leadMinutes === 60 ? t("1 hour") : t("{0} minutes", leadMinutes);
  return { title: task.title, body: t("Starts in {0}, at {1}.", lead, formatClockTime(moment.startsAt)) };
}

// Add sheet: the pill's spoken label, "At start", "15 min before", "1 hour before"; null = no reminder.
export function reminderLabel(minutesBefore: number | null): string {
  if (minutesBefore === null) return t("No reminder");
  if (minutesBefore === 0) return t("At start");
  if (minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60;
    return hours === 1 ? t("1 hour before") : t("{0} hours before", hours);
  }
  return t("{0} min before", minutesBefore);
}

// Add sheet: short chip wording under "Remind me · before it starts": "Off", "At start", "15 min", "1 hour".
export function reminderChipLabel(minutesBefore: number | null): string {
  if (minutesBefore === null) return t("Off");
  if (minutesBefore === 0) return t("At start");
  if (minutesBefore % 60 === 0) return minutesBefore === 60 ? t("1 hour") : t("{0} hours", minutesBefore / 60);
  return t("{0} min", minutesBefore);
}

// Add sheet: the line under the reminder choices, "We'll nudge you at 14:45 today."
export function reminderHint(moment: Pick<TaskReminderMoment, "fireAt"> | null, now: Date): string {
  if (!moment) return t("That moment has already passed, so there's nothing to remind.");
  const fireKey = toLocalDateKey(moment.fireAt);
  const todayKey = toLocalDateKey(now);
  const time = formatClockTime(moment.fireAt);
  const daysAhead = daysBetween(todayKey, fireKey);
  if (daysAhead === 0) return t("We'll nudge you at {0} today.", time);
  if (daysAhead === 1) return t("We'll nudge you at {0} tomorrow.", time);
  return t("We'll nudge you at {0} on {1}.", time, formatDueLabel(fireKey, "on", todayKey));
}

export const REMINDER_PERMISSION_OFF =
  msg("Notifications are off for PaceTasks. Turn them on in iPhone Settings to get this reminder.");
export const TASK_REMINDERS_SWITCHED_OFF = msg("Task reminders are off in Settings, so this one won't arrive.");

// Settings wording for the reminders section.
export const REMINDERS_SECTION_LABEL = "REMINDERS";
export const CHECK_IN_TITLE = msg("Daily check-in");
export const checkInSubtitle = (time: string) => t("One quiet nudge at {0}, only if tasks are still open", time);
export const REMINDERS_BLOCKED_MESSAGE = msg("Notifications are turned off for PaceTasks, so reminders can't arrive.");
export const REMINDERS_BLOCKED_ACTION = msg("Open iPhone Settings");
export const TASK_REMINDER_TITLE = msg("Task reminders");
export const TASK_REMINDER_SUBTITLE = msg("The nudge you pick when a task has a start time");
