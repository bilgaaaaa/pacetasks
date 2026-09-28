import { Task, TaskTiming } from "./types";

export interface TaskHistoryEntry {
  title: string; // most recent casing used for this task name
  timing: TaskTiming; // most recently used category for this task
  lastMinutes: number; // last actual time if ever completed, else last estimate
  minMinutes: number | null; // only meaningful once completed at least once
  maxMinutes: number | null;
  timesCompleted: number;
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Groups every task the user has ever typed by name (case-insensitive) so
// the quick-add bar can recognize a recurring task and suggest how long it
// usually takes instead of asking the user to guess every time. `tasks` is
// expected newest-first (as fetchTasks returns it), so the first occurrence
// of a given title is always the most recent one.
export function buildTaskHistory(tasks: Task[]): Map<string, TaskHistoryEntry> {
  const history = new Map<string, TaskHistoryEntry>();

  for (const task of tasks) {
    const key = normalizeTitle(task.title);
    if (!key) continue;

    const entry = history.get(key);
    if (!entry) {
      history.set(key, {
        title: task.title.trim(),
        timing: task.timing,
        lastMinutes: task.actual_minutes ?? task.estimated_minutes,
        minMinutes: task.actual_minutes,
        maxMinutes: task.actual_minutes,
        timesCompleted: task.actual_minutes !== null ? 1 : 0,
      });
    } else if (task.actual_minutes !== null) {
      entry.minMinutes =
        entry.minMinutes === null
          ? task.actual_minutes
          : Math.min(entry.minMinutes, task.actual_minutes);
      entry.maxMinutes =
        entry.maxMinutes === null
          ? task.actual_minutes
          : Math.max(entry.maxMinutes, task.actual_minutes);
      entry.timesCompleted += 1;
    }
  }

  return history;
}

// Returns up to `limit` past task names that contain `query`, most-completed
// first, for the autocomplete dropdown under the name field.
export function findMatches(
  history: Map<string, TaskHistoryEntry>,
  query: string,
  limit = 4
): TaskHistoryEntry[] {
  const q = normalizeTitle(query);
  if (!q) return [];

  return Array.from(history.values())
    .filter((entry) => normalizeTitle(entry.title).includes(q))
    .sort((a, b) => {
      const aStarts = normalizeTitle(a.title).startsWith(q) ? 0 : 1;
      const bStarts = normalizeTitle(b.title).startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.timesCompleted - a.timesCompleted;
    })
    .slice(0, limit);
}

export function findExactMatch(
  history: Map<string, TaskHistoryEntry>,
  title: string
): TaskHistoryEntry | undefined {
  return history.get(normalizeTitle(title));
}
