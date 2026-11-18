import { isValidTimeOfDay } from "@domain/dates";
import type { TaskTiming } from "@domain/task";
import { t } from "../i18n";

// Start-time helpers for the add sheet's time picker. Times are "HH:MM", 24h,
// the format of tasks.scheduled_time.

const MINUTES_PER_DAY = 24 * 60;

// The minute step of the picker's minute column and of "In 1 hour".
export const TIME_MINUTE_STEP = 5;

// The user's work day, from Settings: tasks are planned around it.
export interface WorkHours {
  workStartHour: number;
  workEndHour: number;
}

export type TimePart = "hour" | "minute";

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function fromMinutes(totalMinutes: number): string {
  const wrapped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

// The hour of a valid time, e.g. 18 for "18:30".
export function hourOf(time: string): number {
  return Math.floor(toMinutes(time) / 60);
}

// Moves a time by whole minutes, wrapping around midnight ("23:30" + 60 → "00:30").
export function shiftTime(time: string, deltaMinutes: number): string {
  if (!isValidTimeOfDay(time)) return time;
  return fromMinutes(toMinutes(time) + deltaMinutes);
}

// Moves only the minutes, wrapping inside the same hour ("18:55" + 5 → "18:00").
export function shiftMinutes(time: string, deltaMinutes: number): string {
  if (!isValidTimeOfDay(time)) return time;
  const hour = hourOf(time);
  const minute = (((toMinutes(time) % 60) + deltaMinutes) % 60 + 60) % 60;
  return fromMinutes(hour * 60 + minute);
}

// `date` + `minutes`, rounded up to the picker's step: 08:32 + 60 → "09:35".
function laterBy(date: Date, minutes: number): string {
  const total = date.getHours() * 60 + date.getMinutes() + minutes;
  return fromMinutes(Math.ceil(total / TIME_MINUTE_STEP) * TIME_MINUTE_STEP);
}

// Where the picker starts when a task gets a time: the next full hour, moved
// outside work hours to fit the task's part of the day, so a nudge never lands
// in the middle of work unless that time was picked by hand.
export function suggestedStartTime(now: Date, timing: TaskTiming, work: WorkHours): string {
  const nextHour = (now.getHours() + 1) % 24;
  const beforeWork = nextHour < work.workStartHour ? nextHour : Math.max(0, work.workStartHour - 1);
  const afterWork = nextHour >= work.workEndHour ? nextHour : work.workEndHour;
  const duringWork = nextHour >= work.workStartHour && nextHour < work.workEndHour;
  switch (timing) {
    case "before_work":
      return fromMinutes(beforeWork * 60);
    case "after_work":
      return fromMinutes(afterWork * 60);
    case "anytime":
      return fromMinutes((duringWork ? afterWork : nextHour) * 60);
  }
}

// A typed hour or minute put into a time: "7" as the hour of "18:30" → "07:30".
// Out-of-range numbers are brought to the nearest valid one; null when nothing usable was typed.
export function withTimePart(time: string, part: TimePart, text: string): string | null {
  const typed = Number.parseInt(text, 10);
  if (!isValidTimeOfDay(time) || Number.isNaN(typed)) return null;
  const [hour, minute] = time.split(":").map(Number);
  const clamped = Math.min(part === "hour" ? 23 : 59, Math.max(0, typed));
  return part === "hour" ? fromMinutes(clamped * 60 + minute) : fromMinutes(hour * 60 + clamped);
}

// One-tap times: "In 1 hour" first, then the hour before work, lunch, the end of
// work and the evening, without any that repeat an earlier one.
export function quickTimeChoices(now: Date, work: WorkHours): { label: string; time: string }[] {
  const choices = [
    { label: t("In 1 hour"), time: laterBy(now, 60) },
    { label: t("Before work"), time: fromMinutes(Math.max(0, work.workStartHour - 1) * 60) },
    { label: "12:30", time: "12:30" },
    { label: t("After work"), time: fromMinutes(work.workEndHour * 60) },
    { label: "20:30", time: "20:30" },
  ];
  return choices.filter((choice, index) => choices.findIndex((other) => other.time === choice.time) === index);
}
