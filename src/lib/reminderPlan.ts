import { addDays, toLocalDateKey } from "@domain/dates";
import { localDateTime, taskReminderMoment } from "@domain/reminders";
import { isPendingToday } from "@domain/todayTasks";
import { Task, UserSettings } from "./types";
import { checkInCopy, taskReminderCopy } from "./reminderCopy";

// How much the app is allowed to interrupt. Reminders are planned a few days
// ahead and re-planned on every use, so they stop by themselves if the app stays closed.
export const REMINDER_POLICY = {
  checkInDays: 5, // days ahead the daily check-in is planned
  taskReminderDays: 7, // days ahead a task's own reminder is planned
  maxTaskReminders: 55, // iOS keeps 64 per app; the check-ins need the rest
} as const;

// Every reminder this app schedules starts with this, so a re-plan can replace them all.
export const REMINDER_ID_PREFIX = "pacetasks-";

export type ReminderKind = "check_in" | "task";

export interface PlannedReminder {
  id: string;
  kind: ReminderKind;
  at: Date;
  title: string;
  body: string;
}

export type ReminderSettings = Pick<UserSettings, "reminder_enabled" | "reminder_time" | "task_reminder_enabled">;

// One quiet check-in per day at the user's time, and only for days that still have open tasks.
function planCheckIns(tasks: Task[], settings: ReminderSettings, now: Date): PlannedReminder[] {
  if (!settings.reminder_enabled) return [];
  const todayKey = toLocalDateKey(now);
  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < REMINDER_POLICY.checkInDays; offset++) {
    const dayKey = addDays(todayKey, offset);
    const at = localDateTime(dayKey, settings.reminder_time);
    if (!at || at <= now) continue;
    const open = tasks.filter((task) => isPendingToday(task, dayKey));
    if (open.length === 0) continue;
    planned.push({ id: `${REMINDER_ID_PREFIX}check-in-${dayKey}`, kind: "check_in", at, ...checkInCopy(open) });
  }
  return planned;
}

// Each open task's own reminder, at the lead time picked on the task, soonest
// first. Every one was asked for, so none is dropped except past the horizon or the iOS limit.
function planTaskReminders(tasks: Task[], settings: ReminderSettings, now: Date): PlannedReminder[] {
  if (!settings.task_reminder_enabled) return [];
  const lastDayKey = addDays(toLocalDateKey(now), REMINDER_POLICY.taskReminderDays - 1);
  const planned: PlannedReminder[] = [];

  for (const task of tasks) {
    const moment = taskReminderMoment(task, now);
    if (!moment || toLocalDateKey(moment.startsAt) > lastDayKey) continue;
    planned.push({
      id: `${REMINDER_ID_PREFIX}task-${task.id}`,
      kind: "task",
      at: moment.fireAt,
      ...taskReminderCopy(task, moment),
    });
  }

  return planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, REMINDER_POLICY.maxTaskReminders);
}

// Everything the phone should have scheduled right now, earliest first. Pure:
// the same tasks, settings and clock always give the same plan.
export function planReminders(tasks: Task[], settings: ReminderSettings, now: Date): PlannedReminder[] {
  return [...planCheckIns(tasks, settings, now), ...planTaskReminders(tasks, settings, now)].sort(
    (a, b) => a.at.getTime() - b.at.getTime()
  );
}
