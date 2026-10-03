import type { TaskTiming } from "./task.ts";

// Maps an hour of the day (0–23) onto the app's before/after-work buckets using
// the user's work hours. One rule for Brain Dump's fixed times and "What can I do now?".
export function timingForHour(hour: number, workStartHour: number, workEndHour: number): TaskTiming {
  if (hour < workStartHour) return "before_work";
  if (hour >= workEndHour) return "after_work";
  return "anytime";
}
