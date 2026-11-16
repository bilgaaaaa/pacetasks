import { clampEstimatedMinutes } from "./task.ts";
import type { Task } from "./task.ts";
import { buildTaskHistory, normalizeTitle } from "./taskHistory.ts";

// Learned pace: how long tasks really take for this user, read from the timer
// history. Planning (Fit my time, Rescue my day) counts a task's real length
// instead of the guess typed when it was added. Pure and shared by the app and Siri;
// the Mac app reads the same history with the same rules (mac/Deskfocus/PaceTasks/PaceModel.swift).

export const PACE_POLICY = {
  historyLimit: 300, // only the latest timed tasks count, the same number the Mac app fetches
  minTimingsForTask: 2, // one timed run is a sample, two start a pattern
  minTimedTasksForRatio: 5, // tasks with a logged duration needed before the overall pace is trusted
  minRatio: 0.5, // the overall pace never more than halves or doubles an estimate
  maxRatio: 2,
} as const;

// What the history says about one task name.
export interface TaskPace {
  usualMinutes: number; // median of the latest timed runs
  timings: number; // how many timed runs back it up
}

export interface PaceModel {
  byTitle: Map<string, TaskPace>; // keyed by normalizeTitle, like taskHistory
  ratio: number | null; // real ÷ estimated minutes over all timed tasks; null until there is enough history
}

export const EMPTY_PACE_MODEL: PaceModel = { byTitle: new Map(), ratio: null };

function isTimed(task: Task): boolean {
  return task.status === "done" && task.actual_minutes !== null && task.actual_minutes > 0;
}

// Reads tasks in any order: the latest timed ones (by creation) give per-name lengths and the overall pace.
export function buildPaceModel(tasks: Task[]): PaceModel {
  const timed = tasks
    .filter(isTimed)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, PACE_POLICY.historyLimit);
  const byTitle = new Map<string, TaskPace>();
  for (const [key, entry] of buildTaskHistory(timed)) {
    byTitle.set(key, { usualMinutes: entry.usualMinutes, timings: entry.recentMinutes.length });
  }
  return { byTitle, ratio: overallRatio(timed) };
}

function overallRatio(timed: Task[]): number | null {
  if (timed.length < PACE_POLICY.minTimedTasksForRatio) return null;
  const actual = timed.reduce((sum, task) => sum + (task.actual_minutes as number), 0);
  const estimated = timed.reduce((sum, task) => sum + task.estimated_minutes, 0);
  if (estimated === 0) return null;
  return Math.min(PACE_POLICY.maxRatio, Math.max(PACE_POLICY.minRatio, actual / estimated));
}

// How long the task will most likely take: its own usual length once timed twice;
// its typed estimate when timed once (the add sheet already filled that in from the
// run); otherwise the estimate scaled by the user's overall pace.
export function expectedMinutes(task: Pick<Task, "title" | "estimated_minutes">, model: PaceModel): number {
  const pace = model.byTitle.get(normalizeTitle(task.title));
  if (pace && pace.timings >= PACE_POLICY.minTimingsForTask) return pace.usualMinutes;
  if (pace || model.ratio === null) return task.estimated_minutes;
  return clampEstimatedMinutes(task.estimated_minutes * model.ratio);
}

// True when the model changes at least one length, so screens can say "at your pace".
export function hasLearnedPace(model: PaceModel): boolean {
  if (model.ratio !== null) return true;
  for (const pace of model.byTitle.values()) if (pace.timings >= PACE_POLICY.minTimingsForTask) return true;
  return false;
}
