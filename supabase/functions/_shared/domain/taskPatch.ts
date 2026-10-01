import type { Task } from "./task.ts";

// The fields a task can change after it exists, other than being completed.
// Kept this narrow so every caller (app, rollover, Weekly Reset, Siri) moves and
// parks tasks the same way.
export type TaskPatch = Partial<Pick<Task, "status" | "due_date" | "due_kind">>;

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

// Moves a task to another day, keeping whether its date is a day ("on") or a deadline ("by").
export function reschedulePatch(task: Task, dueDate: string): TaskPatch {
  return { due_date: dueDate, due_kind: task.due_kind ?? "on" };
}
