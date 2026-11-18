// What the DeskFocus widget gets from PaceTasks, and which of its check-offs the app still has to apply.
// The widget decodes the same field names in targets/deskfocus/_shared/PaceTasksFeed.swift.
import { addDays } from "@domain/dates";
import { expectedMinutes } from "@domain/pace";
import type { PaceModel } from "@domain/pace";
import { isPendingToday, selectTodayTasks } from "@domain/todayTasks";
import type { DueKind, Task } from "./types";

// Most tasks the widget is given; the large widget shows far fewer, the rest only keeps "Up next" right.
export const WIDGET_TASK_LIMIT = 30;

export interface WidgetPaceTask {
  id: string;
  title: string;
  estimatedMinutes: number; // at the user's learned pace; used as the focus length when ▶ is pressed
  scheduledTime: string | null; // "HH:MM", 24h
  dueDate: string | null; // "YYYY-MM-DD"; the widget drops tasks not due yet on its own day
  dueKind: DueKind | null;
}

// Today's open tasks in the Today list's order, then tomorrow's, so the widget is still right after midnight
// before the app is opened again. Trimmed to what the widget needs.
export function widgetPaceTasks(tasks: Task[], todayKey: string, paceModel: PaceModel): WidgetPaceTask[] {
  const upToTomorrow = selectTodayTasks(tasks, addDays(todayKey, 1)).pending;
  const today = upToTomorrow.filter((task) => isPendingToday(task, todayKey));
  const tomorrowOnly = upToTomorrow.filter((task) => !isPendingToday(task, todayKey));
  return [...today, ...tomorrowOnly].slice(0, WIDGET_TASK_LIMIT).map((task) => ({
    id: task.id,
    title: task.title,
    estimatedMinutes: expectedMinutes(task, paceModel),
    scheduledTime: task.scheduled_time,
    dueDate: task.due_date,
    dueKind: task.due_kind,
  }));
}

// A check-off from the widget or the Live Activity: the task and the minutes really
// focused on it in a DeskFocus session, or null when it was ticked without one.
export interface WidgetCompletion {
  id: string;
  minutes: number | null;
}

function toWidgetCompletion(entry: unknown): WidgetCompletion | null {
  // Builds before 16 Nov 2026 wrote bare ids.
  if (typeof entry === "string") return { id: entry, minutes: null };
  if (typeof entry !== "object" || entry === null) return null;
  const { id, minutes } = entry as { id?: unknown; minutes?: unknown };
  if (typeof id !== "string") return null;
  return { id, minutes: typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0 ? minutes : null };
}

// Reads what the widget wrote; anything unreadable counts as "none" so a bad value never blocks the app.
export function parseWidgetCompletions(raw: string | null): WidgetCompletion[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toWidgetCompletion).filter((completion): completion is WidgetCompletion => completion !== null);
  } catch {
    return [];
  }
}

// Of the widget's check-offs, the ones still open in PaceTasks (once each); others are already done or gone.
export function completionsToApply(completions: WidgetCompletion[], tasks: Task[]): WidgetCompletion[] {
  const pending = new Set(tasks.filter((task) => task.status === "pending").map((task) => task.id));
  const seen = new Set<string>();
  return completions.filter((completion) => {
    if (!pending.has(completion.id) || seen.has(completion.id)) return false;
    seen.add(completion.id);
    return true;
  });
}
