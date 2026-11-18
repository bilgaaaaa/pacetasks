import { isValidTimeOfDay } from "./dates.ts";
import type { Task } from "./task.ts";

// When during its day a task happens: any time, at a fixed start, or inside a
// window ("after 20:00", "before 18:00", "between 19:00 and 21:00"). Stored as
// scheduled_time / window_start / window_end; this is the one place that maps
// between the two, so the app, Brain Dump and Siri agree on every rule.

export const TASK_TIME_KINDS = ["any", "at", "after", "before", "between"] as const;
export type TaskTimeKind = (typeof TASK_TIME_KINDS)[number];

export type TaskTime =
  | { kind: "any" }
  | { kind: "at"; time: string }
  | { kind: "after"; start: string }
  | { kind: "before"; end: string }
  | { kind: "between"; start: string; end: string };

export type TaskTimeFields = Pick<Task, "scheduled_time" | "window_start" | "window_end">;

export const ANY_TIME: TaskTime = { kind: "any" };

// Reads the stored columns; a fixed start wins if a bad row ever had both.
export function taskTimeOf(fields: TaskTimeFields): TaskTime {
  if (fields.scheduled_time) return { kind: "at", time: fields.scheduled_time };
  const { window_start: start, window_end: end } = fields;
  if (start && end) return { kind: "between", start, end };
  if (start) return { kind: "after", start };
  if (end) return { kind: "before", end };
  return ANY_TIME;
}

// The columns to store for a time, every one set so an edit also clears the old kind.
export function timeFields(time: TaskTime): TaskTimeFields {
  switch (time.kind) {
    case "at":
      return { scheduled_time: time.time, window_start: null, window_end: null };
    case "after":
      return { scheduled_time: null, window_start: time.start, window_end: null };
    case "before":
      return { scheduled_time: null, window_start: null, window_end: time.end };
    case "between":
      return { scheduled_time: null, window_start: time.start, window_end: time.end };
    case "any":
      return { scheduled_time: null, window_start: null, window_end: null };
  }
}

// True when the database would accept the time: valid "HH:MM" values and a window that starts before it ends.
export function isValidTaskTime(time: TaskTime): boolean {
  switch (time.kind) {
    case "any":
      return true;
    case "at":
      return isValidTimeOfDay(time.time);
    case "after":
      return isValidTimeOfDay(time.start);
    case "before":
      return isValidTimeOfDay(time.end);
    case "between":
      return isValidTimeOfDay(time.start) && isValidTimeOfDay(time.end) && time.start < time.end;
  }
}

// The moment a reminder counts back from: the fixed start, or the start of the window.
export function reminderAnchor(fields: TaskTimeFields): string | null {
  return fields.scheduled_time ?? fields.window_start ?? null;
}

// True when a window has room for the task at `timeOfDay` ("HH:MM"): it has started and not yet ended.
// Tasks without a window are always open; a fixed start is not a window and is handled by its slot.
export function isWindowOpen(fields: TaskTimeFields, timeOfDay: string): boolean {
  if (fields.window_start && timeOfDay < fields.window_start) return false;
  if (fields.window_end && timeOfDay >= fields.window_end) return false;
  return true;
}

// Orders a day's tasks by when they happen: the fixed start, else the window's start, else its end.
export function timeSortKey(fields: TaskTimeFields): string | null {
  return fields.scheduled_time ?? fields.window_start ?? fields.window_end ?? null;
}
