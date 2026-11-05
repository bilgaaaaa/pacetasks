// What the Deskfocus widget gets from PaceTasks, and which of its check-offs the app still has to apply.
// The widget decodes the same field names in targets/deskfocus/_shared/PaceTasksFeed.swift.
import { addDays } from "@domain/dates";
import { isPendingToday, selectTodayTasks } from "@domain/todayTasks";
import type { DueKind, Task } from "./types";

// Most tasks the widget is given; the large widget shows far fewer, the rest only keeps "Up next" right.
export const WIDGET_TASK_LIMIT = 30;

export interface WidgetPaceTask {
  id: string;
  title: string;
  estimatedMinutes: number; // used as the focus length when ▶ is pressed
  scheduledTime: string | null; // "HH:MM", 24h
  dueDate: string | null; // "YYYY-MM-DD"; the widget drops tasks not due yet on its own day
  dueKind: DueKind | null;
}

// Today's open tasks in the Today list's order, then tomorrow's, so the widget is still right after midnight
// before the app is opened again. Trimmed to what the widget needs.
export function widgetPaceTasks(tasks: Task[], todayKey: string): WidgetPaceTask[] {
  const upToTomorrow = selectTodayTasks(tasks, addDays(todayKey, 1)).pending;
  const today = upToTomorrow.filter((task) => isPendingToday(task, todayKey));
  const tomorrowOnly = upToTomorrow.filter((task) => !isPendingToday(task, todayKey));
  return [...today, ...tomorrowOnly].slice(0, WIDGET_TASK_LIMIT).map((task) => ({
    id: task.id,
    title: task.title,
    estimatedMinutes: task.estimated_minutes,
    scheduledTime: task.scheduled_time,
    dueDate: task.due_date,
    dueKind: task.due_kind,
  }));
}

// Reads the ids the widget wrote; anything unreadable counts as "none" so a bad value never blocks the app.
export function parseWidgetCompletions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

// Of the widget's check-offs, the ones still open in PaceTasks; others are already done or gone.
export function completionsToApply(ids: string[], tasks: Task[]): string[] {
  const pending = new Set(tasks.filter((task) => task.status === "pending").map((task) => task.id));
  return [...new Set(ids)].filter((id) => pending.has(id));
}
