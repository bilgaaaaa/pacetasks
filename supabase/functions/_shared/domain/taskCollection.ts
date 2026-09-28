import type { Task } from "./task.ts";

// Inserts or replaces a task by id, keeping the list newest-first (the order
// fetchTasks returns). Idempotent, so a local create and its Realtime echo
// can both be applied without producing a duplicate.
export function upsertTask(tasks: Task[], task: Task): Task[] {
  const withoutTask = tasks.filter((t) => t.id !== task.id);
  const insertAt = withoutTask.findIndex((t) => t.created_at < task.created_at);
  if (insertAt === -1) return [...withoutTask, task];
  return [...withoutTask.slice(0, insertAt), task, ...withoutTask.slice(insertAt)];
}

// Removes a task by id; a no-op when it isn't in the list.
export function removeTask(tasks: Task[], taskId: string): Task[] {
  return tasks.some((t) => t.id === taskId) ? tasks.filter((t) => t.id !== taskId) : tasks;
}
