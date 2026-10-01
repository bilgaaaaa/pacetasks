import { timingForHour } from "@domain/timing";
import type { TaskTiming } from "@domain/task";

// The phone's own context: "today" and "now" always come from the device's clock
// in its time zone, and the locale is only a hint (not the input language).

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getDeviceLocale(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().locale || null;
}

// Where "now" falls in the user's day (before work, during, after), from the phone's clock.
export function getCurrentTiming(workStartHour: number, workEndHour: number): TaskTiming {
  return timingForHour(new Date().getHours(), workStartHour, workEndHour);
}
