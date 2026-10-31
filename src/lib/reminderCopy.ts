import { toLocalDateKey } from "@domain/dates";
import { TaskReminderMoment } from "@domain/reminders";
import { formatDueLabel } from "./dueLabel";
import { Task } from "./types";

// Wording for reminders: the notifications themselves, the add sheet's
// reminder choices, and the Settings section.

export interface ReminderText {
  title: string;
  body: string;
}

const minutesLabel = (minutes: number) => `${minutes} min`;

// "14:45" for a Date, in the phone's local time.
export function formatClockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// The daily check-in: says what is really left, and points at the easiest way in.
export function checkInCopy(open: Task[]): ReminderText {
  const quickest = open.reduce((best, task) => (task.estimated_minutes < best.estimated_minutes ? task : best));
  if (open.length === 1) {
    return { title: "One thing left today", body: `${quickest.title}, about ${minutesLabel(quickest.estimated_minutes)}.` };
  }
  return {
    title: `${open.length} things left today`,
    body: `The quickest is ${quickest.title}, about ${minutesLabel(quickest.estimated_minutes)}.`,
  };
}

// A task's own reminder: "Starts in 10 minutes, at 18:30." or "Starting now, about 15 min."
export function taskReminderCopy(
  task: Pick<Task, "title" | "estimated_minutes">,
  moment: Pick<TaskReminderMoment, "fireAt" | "startsAt">
): ReminderText {
  const leadMinutes = Math.round((moment.startsAt.getTime() - moment.fireAt.getTime()) / 60_000);
  if (leadMinutes === 0) {
    return { title: task.title, body: `Starting now, about ${minutesLabel(task.estimated_minutes)}.` };
  }
  const lead = leadMinutes === 60 ? "1 hour" : `${leadMinutes} minutes`;
  return { title: task.title, body: `Starts in ${lead}, at ${formatClockTime(moment.startsAt)}.` };
}

// Add sheet: the pill's spoken label, "At start", "15 min before", "1 hour before"; null = no reminder.
export function reminderLabel(minutesBefore: number | null): string {
  if (minutesBefore === null) return "No reminder";
  if (minutesBefore === 0) return "At start";
  if (minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"} before`;
  }
  return `${minutesBefore} min before`;
}

// Add sheet: short chip wording under "Remind me · before it starts": "Off", "At start", "15 min", "1 hour".
export function reminderChipLabel(minutesBefore: number | null): string {
  if (minutesBefore === null) return "Off";
  if (minutesBefore === 0) return "At start";
  if (minutesBefore % 60 === 0) return `${minutesBefore / 60} ${minutesBefore === 60 ? "hour" : "hours"}`;
  return `${minutesBefore} min`;
}

// Add sheet: the line under the reminder choices, "We'll nudge you at 14:45 today."
export function reminderHint(moment: Pick<TaskReminderMoment, "fireAt"> | null, now: Date): string {
  if (!moment) return "That moment has already passed, so there's nothing to remind.";
  const day = formatDueLabel(toLocalDateKey(moment.fireAt), "on", toLocalDateKey(now));
  const when = day === "Today" || day === "Tomorrow" ? day.toLowerCase() : `on ${day}`;
  return `We'll nudge you at ${formatClockTime(moment.fireAt)} ${when}.`;
}

export const REMINDER_PERMISSION_OFF =
  "Notifications are off for PaceTasks. Turn them on in iPhone Settings to get this reminder.";
export const TASK_REMINDERS_SWITCHED_OFF = "Task reminders are off in Settings, so this one won't arrive.";

// Settings wording for the reminders section.
export const REMINDERS_SECTION_LABEL = "REMINDERS";
export const CHECK_IN_TITLE = "Daily check-in";
export const checkInSubtitle = (time: string) => `One quiet nudge at ${time}, only if tasks are still open`;
export const REMINDERS_BLOCKED_MESSAGE = "Notifications are turned off for PaceTasks, so reminders can't arrive.";
export const REMINDERS_BLOCKED_ACTION = "Open iPhone Settings";
export const TASK_REMINDER_TITLE = "Task reminders";
export const TASK_REMINDER_SUBTITLE = "The nudge you pick when a task has a start time";
