import { addDays, isValidTimeOfDay, toLocalDateKey } from "@domain/dates";
import { isPendingToday } from "@domain/todayTasks";
import { Task, UserSettings } from "./types";
import { checkInCopy, taskReminderCopy } from "./reminderCopy";

// How much the app is allowed to interrupt. Reminders are planned a few days
// ahead and re-planned on every use, so they stop by themselves if the app stays closed.
export const REMINDER_POLICY = {
  checkInDays: 5, // days ahead the daily check-in is planned
  taskReminderDays: 7, // days ahead a timed task's reminder is planned
  taskLeadMinutes: 10, // how long before its start time a timed task reminds
  maxTaskRemindersPerDay: 3,
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

// The phone-local moment of a calendar day and a 24h "HH:MM" time; null when the time is malformed.
function localDateTime(dateKey: string, time: string): Date | null {
  const timeOfDay = time.slice(0, 5); // the database may return "HH:MM:SS"
  if (!isValidTimeOfDay(timeOfDay)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeOfDay.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

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

// The day a timed task is expected to happen: its exact day when that is still ahead, otherwise today.
function taskDay(task: Task, todayKey: string): string {
  return task.due_kind === "on" && task.due_date && task.due_date > todayKey ? task.due_date : todayKey;
}

// A heads-up shortly before each open task that has a fixed start time, capped per day.
function planTaskReminders(tasks: Task[], settings: ReminderSettings, now: Date): PlannedReminder[] {
  if (!settings.task_reminder_enabled) return [];
  const todayKey = toLocalDateKey(now);
  const lastDayKey = addDays(todayKey, REMINDER_POLICY.taskReminderDays - 1);
  const perDay = new Map<string, PlannedReminder[]>();

  for (const task of tasks) {
    if (task.status !== "pending" || !task.scheduled_time) continue;
    const dayKey = taskDay(task, todayKey);
    if (dayKey > lastDayKey) continue;
    const start = localDateTime(dayKey, task.scheduled_time);
    if (!start) continue;
    const at = new Date(start.getTime() - REMINDER_POLICY.taskLeadMinutes * 60_000);
    if (at <= now) continue;
    const reminder: PlannedReminder = {
      id: `${REMINDER_ID_PREFIX}task-${task.id}`,
      kind: "task",
      at,
      ...taskReminderCopy(task, REMINDER_POLICY.taskLeadMinutes),
    };
    perDay.set(dayKey, [...(perDay.get(dayKey) ?? []), reminder]);
  }

  return [...perDay.values()].flatMap((dayReminders) =>
    dayReminders.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, REMINDER_POLICY.maxTaskRemindersPerDay)
  );
}

// Everything the phone should have scheduled right now, earliest first. Pure:
// the same tasks, settings and clock always give the same plan.
export function planReminders(tasks: Task[], settings: ReminderSettings, now: Date): PlannedReminder[] {
  return [...planCheckIns(tasks, settings, now), ...planTaskReminders(tasks, settings, now)].sort(
    (a, b) => a.at.getTime() - b.at.getTime()
  );
}
