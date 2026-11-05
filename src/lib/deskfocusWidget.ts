// What the Deskfocus widget gets from PaceTasks, and which of its check-offs the app still has to apply.
// The widget decodes the same field names in targets/deskfocus/_shared/Sync/PaceTasksFeed.swift.
import { selectTodayTasks } from "@domain/todayTasks";
import type { Task } from "./types";

// Most tasks the widget is given; the large widget shows far fewer, the rest only keeps "Up next" right.
export const WIDGET_TASK_LIMIT = 30;

export interface WidgetPaceTask {
  id: string;
  title: string;
  estimatedMinutes: number; // used as the focus length when ▶ is pressed
  scheduledTime: string | null; // "HH:MM", 24h
}

// Today's open tasks in the Today list's order, trimmed to what the widget needs.
export function widgetPaceTasks(tasks: Task[], todayKey: string): WidgetPaceTask[] {
  return selectTodayTasks(tasks, todayKey)
    .pending.slice(0, WIDGET_TASK_LIMIT)
    .map((task) => ({
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimated_minutes,
      scheduledTime: task.scheduled_time,
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
