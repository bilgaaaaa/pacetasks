import { daysBetween, toLocalDateKey } from "@domain/dates";
import { normalizeTitle } from "@domain/taskHistory";
import { Task, TaskTiming } from "./types";

// How often each recurring task actually gets done, learned from completed
// tasks: when it was last done and its usual gap between times. Feeds the
// one-tap "usuals" in the add sheet (and later the History screens).

export interface TaskRhythm {
  key: string; // normalized title, shared with taskHistory
  title: string; // most recent casing
  category: string | null;
  timing: TaskTiming;
  lastMinutes: number; // real time of the latest completion, else its estimate
  timesDone: number;
  lastDoneKey: string; // "YYYY-MM-DD" of the latest completion, phone's local day
  daysSince: number;
  usualGapDays: number | null; // median days between completions; null until done on 2+ days
  lateByDays: number | null; // days past the usual gap; negative = still ahead of it
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// One rhythm per task name that has been completed at least once.
export function buildTaskRhythms(tasks: Task[], todayKey: string): TaskRhythm[] {
  const byTitle = new Map<string, { task: Task; dayKey: string }[]>();
  for (const task of tasks) {
    if (task.status !== "done" || !task.completed_at) continue;
    const key = normalizeTitle(task.title);
    if (!key) continue;
    const entry = { task, dayKey: toLocalDateKey(new Date(task.completed_at)) };
    byTitle.set(key, [...(byTitle.get(key) ?? []), entry]);
  }

  return Array.from(byTitle.entries()).map(([key, entries]) => {
    const sorted = [...entries].sort((a, b) => (a.task.completed_at! < b.task.completed_at! ? -1 : 1));
    const latest = sorted[sorted.length - 1].task;
    const days = Array.from(new Set(sorted.map((e) => e.dayKey)));
    const gaps = days.slice(1).map((day, i) => daysBetween(days[i], day));
    const lastDoneKey = days[days.length - 1];
    const daysSince = daysBetween(lastDoneKey, todayKey);
    const usualGapDays = gaps.length > 0 ? Math.max(1, median(gaps)) : null;
    return {
      key,
      title: latest.title.trim(),
      category: latest.category,
      timing: latest.timing,
      lastMinutes: latest.actual_minutes ?? latest.estimated_minutes,
      timesDone: sorted.length,
      lastDoneKey,
      daysSince,
      usualGapDays,
      lateByDays: usualGapDays === null ? null : daysSince - usualGapDays,
    };
  });
}

// Tasks done on 2+ occasions and not already waiting on the list, the most
// overdue (relative to their own rhythm) first, then the most frequent.
export function selectUsuals(tasks: Task[], todayKey: string, limit = 6): TaskRhythm[] {
  const pendingKeys = new Set(tasks.filter((t) => t.status === "pending").map((t) => normalizeTitle(t.title)));
  const lateness = (r: TaskRhythm) => (r.lateByDays !== null && r.usualGapDays ? r.lateByDays / r.usualGapDays : -Infinity);

  return buildTaskRhythms(tasks, todayKey)
    .filter((r) => r.timesDone >= 2 && !pendingKeys.has(r.key))
    .sort((a, b) => lateness(b) - lateness(a) || b.timesDone - a.timesDone || b.daysSince - a.daysSince)
    .slice(0, limit);
}

export function isLate(rhythm: TaskRhythm): boolean {
  return rhythm.lateByDays !== null && rhythm.lateByDays > 0;
}

// "Today", "Yesterday", or "9 days ago", plus "· usually 7" when a rhythm is known.
export function describeLastDone(rhythm: TaskRhythm): string {
  const when =
    rhythm.daysSince <= 0 ? "Today" : rhythm.daysSince === 1 ? "Yesterday" : `${rhythm.daysSince} days ago`;
  return rhythm.usualGapDays !== null && rhythm.usualGapDays > 1 ? `${when} · usually ${rhythm.usualGapDays}` : when;
}
