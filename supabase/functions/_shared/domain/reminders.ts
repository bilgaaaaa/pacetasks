import { addDays, isValidTimeOfDay, toLocalDateKey } from "./dates.ts";
import type { Task } from "./task.ts";

// When a task's own reminder goes off. Pure and clock-free, so the phone's
// reminder plan, the add sheet's "We'll nudge you at…" line and the tests share
// one rule. Times are the phone's local time.

// The reminder choices offered in the app, in minutes before the start time.
export const REMINDER_OFFSETS = [0, 5, 10, 15, 30, 60] as const;

// What a task gets when it receives a start time: a heads-up shortly before.
export const DEFAULT_REMINDER_MINUTES = 10;

export type ReminderTask = Pick<
  Task,
  "id" | "status" | "scheduled_time" | "reminder_minutes_before" | "due_date" | "due_kind"
>;

export interface TaskReminderMoment {
  taskId: string;
  fireAt: Date; // when the notification shows
  startsAt: Date; // when the task starts
}

// The phone-local moment of a calendar day and a 24h "HH:MM" time; null when the time is malformed.
export function localDateTime(dateKey: string, time: string): Date | null {
  const timeOfDay = time.slice(0, 5); // the database may return "HH:MM:SS"
  if (!isValidTimeOfDay(timeOfDay)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeOfDay.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// The next start of a task that has a time. A task "on" a later day starts that
// day. Everything else on Today (no day, a deadline, overdue) starts at its time
// today, or tomorrow once today's reminder moment has passed, but never after a
// deadline that is still ahead.
export function nextStart(task: ReminderTask, now: Date): Date | null {
  if (!task.scheduled_time) return null;
  const todayKey = toLocalDateKey(now);

  if (task.due_kind === "on" && task.due_date && task.due_date > todayKey) {
    return localDateTime(task.due_date, task.scheduled_time);
  }

  const todayStart = localDateTime(todayKey, task.scheduled_time);
  if (!todayStart) return null;
  const leadMs = (task.reminder_minutes_before ?? 0) * 60_000;
  const dayKey = todayStart.getTime() - leadMs > now.getTime() ? todayKey : addDays(todayKey, 1);

  const deadlineAhead = task.due_kind === "by" && task.due_date !== null && task.due_date >= todayKey;
  if (deadlineAhead && dayKey > task.due_date!) return null;
  return localDateTime(dayKey, task.scheduled_time);
}

// The reminder of one task, or null when it has none, isn't open, or its moment has passed.
export function taskReminderMoment(task: ReminderTask, now: Date): TaskReminderMoment | null {
  if (task.status !== "pending" || task.reminder_minutes_before === null) return null;

  const startsAt = nextStart(task, now);
  if (!startsAt) return null;

  const fireAt = new Date(startsAt.getTime() - task.reminder_minutes_before * 60_000);
  if (fireAt.getTime() <= now.getTime()) return null;
  return { taskId: task.id, fireAt, startsAt };
}
