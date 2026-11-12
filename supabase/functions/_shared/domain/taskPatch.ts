import type { Task } from "./task.ts";

// What the edit sheet can change on a task. One list, so the app, the patch
// type and the tests agree on what "editing a task" means.
export const EDITABLE_TASK_FIELDS = [
  "title",
  "estimated_minutes",
  "timing",
  "category",
  "energy_level",
  "scheduled_time",
  "reminder_minutes_before",
  "due_date",
  "due_kind",
  "notes",
] as const;

// A task as it should be after an edit: every editable field, changed or not.
export type TaskEdit = Pick<Task, (typeof EDITABLE_TASK_FIELDS)[number]>;

// The fields a task can change after it exists, other than being completed.
// Every caller (app, rollover, Weekly Reset, Siri) moves, parks and edits tasks through these.
export type TaskPatch = Partial<Pick<Task, "status"> & TaskEdit>;

// One task's change, for applying several at once (rollover, Weekly Reset).
export interface TaskChange {
  taskId: string;
  patch: TaskPatch;
}

// Parks a task as "someday". Its date is dropped, so bringing it back later
// never makes it instantly overdue.
export const PARK_PATCH: TaskPatch = { status: "someday", due_date: null, due_kind: null };

// Brings a parked task back: pending and undated, so it shows on Today.
export const UNPARK_PATCH: TaskPatch = { status: "pending" };

// Only what an edit really changed, so an untouched task is never written. Keeps
// the database's rules: no reminder without a start time, no due kind without a day.
export function editPatch(task: Task, edit: TaskEdit): TaskPatch {
  const wanted: TaskEdit = {
    ...edit,
    notes: edit.notes?.trim() || null,
    reminder_minutes_before: edit.scheduled_time ? edit.reminder_minutes_before : null,
    due_kind: edit.due_date ? edit.due_kind ?? "on" : null,
  };
  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_TASK_FIELDS) {
    if (task[field] !== wanted[field]) patch[field] = wanted[field];
  }
  return patch as TaskPatch;
}

// Moves a task to another day, keeping whether its date is a day ("on") or a deadline ("by").
export function reschedulePatch(task: Task, dueDate: string): TaskPatch {
  return { due_date: dueDate, due_kind: task.due_kind ?? "on" };
}
