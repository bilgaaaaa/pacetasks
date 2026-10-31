import { isValidTimeOfDay } from "@domain/dates";

// Start-time helpers for the add sheet's time picker. Times are "HH:MM", 24h,
// the format of tasks.scheduled_time.

const MINUTES_PER_DAY = 24 * 60;

// The minute step of the picker's minute column and of "In 1 hour".
export const TIME_MINUTE_STEP = 5;

// Fixed shortcuts next to "In 1 hour": morning, lunch, after work, evening.
const FIXED_QUICK_TIMES = ["09:00", "12:30", "18:00", "20:30"];

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

// Where the picker starts when a task gets a time: the next full hour.
export function suggestedStartTime(now: Date): string {
  return fromMinutes((now.getHours() + 1) * 60);
}

// One-tap times: "In 1 hour" first, then the fixed shortcuts that are not the same time.
export function quickTimeChoices(now: Date): { label: string; time: string }[] {
  const inAnHour = laterBy(now, 60);
  return [
    { label: "In 1 hour", time: inAnHour },
    ...FIXED_QUICK_TIMES.filter((time) => time !== inAnHour).map((time) => ({ label: time, time })),
  ];
}
