import { CATEGORY_IDS } from "@domain/categories";
import { TIMING_ORDER } from "@domain/todayTasks";
import { Task, TaskTiming } from "./types";
import { GroupBy } from "./appearance";
import { getCategory, NO_CATEGORY } from "./categories";

// Splits Today's pending tasks into the sections the user picked in Settings
// (by size, place, category, time of day, or one plain list). Pure, so the
// list screen and tests share the exact same grouping.

export type TaskPlace = "home" | "out" | "work" | "anywhere";

export const PLACE_ORDER: TaskPlace[] = ["home", "out", "work", "anywhere"];

export const PLACE_LABELS: Record<TaskPlace, string> = {
  home: "At home",
  out: "Out & about",
  work: "At work",
  anywhere: "Anywhere",
};

export const TIMING_LABELS: Record<TaskTiming, string> = {
  before_work: "Before work",
  anytime: "Anytime",
  after_work: "After work",
};

export interface TaskSection {
  key: string;
  title: string;
  tasks: Task[];
  totalMinutes: number;
}

// Where a task gets done, derived from its category: shopping happens out,
// home chores at home, work at work; everything else can be done anywhere.
export function placeOfTask(task: Pick<Task, "category">): TaskPlace {
  switch (task.category) {
    case "home":
      return "home";
    case "shopping":
      return "out";
    case "work":
      return "work";
    default:
      return "anywhere";
  }
}

// A quick win is a short task with no fixed start time (fixed-time tasks are Focus sessions).
export function isQuickWin(task: Pick<Task, "estimated_minutes" | "scheduled_time">, quickWinMinutes: number): boolean {
  return !task.scheduled_time && task.estimated_minutes <= quickWinMinutes;
}

function sumMinutes(tasks: Task[]): number {
  return tasks.reduce((total, task) => total + task.estimated_minutes, 0);
}

function buildSections(
  tasks: Task[],
  buckets: { key: string; title: string; matches: (task: Task) => boolean }[]
): TaskSection[] {
  return buckets
    .map(({ key, title, matches }) => {
      const sectionTasks = tasks.filter(matches);
      return { key, title, tasks: sectionTasks, totalMinutes: sumMinutes(sectionTasks) };
    })
    .filter((section) => section.tasks.length > 0);
}

// Keeps each task's position from `pending` (already in timing order), drops empty sections.
export function groupTodayTasks(pending: Task[], groupBy: GroupBy, quickWinMinutes: number): TaskSection[] {
  switch (groupBy) {
    case "size":
      return buildSections(pending, [
        { key: "quick", title: "Quick wins", matches: (t) => isQuickWin(t, quickWinMinutes) },
        { key: "longer", title: "Takes a while", matches: (t) => !isQuickWin(t, quickWinMinutes) },
      ]);
    case "place":
      return buildSections(
        pending,
        PLACE_ORDER.map((place) => ({
          key: place,
          title: PLACE_LABELS[place],
          matches: (t: Task) => placeOfTask(t) === place,
        }))
      );
    case "category":
      return buildSections(pending, [
        ...CATEGORY_IDS.map((id) => ({
          key: id,
          title: getCategory(id).label,
          matches: (t: Task) => t.category === id,
        })),
        {
          key: NO_CATEGORY.id,
          title: NO_CATEGORY.label,
          matches: (t: Task) => getCategory(t.category) === NO_CATEGORY,
        },
      ]);
    case "when":
      return buildSections(
        pending,
        TIMING_ORDER.map((timing) => ({
          key: timing,
          title: TIMING_LABELS[timing],
          matches: (t: Task) => t.timing === timing,
        }))
      );
    case "none":
      return buildSections(pending, [{ key: "all", title: "All tasks", matches: () => true }]);
  }
}

export interface TodaySummary {
  count: number;
  totalMinutes: number;
  quickWinCount: number;
}

// Numbers for the "7 left, about 62 min. 4 take 5 minutes or less." header line.
export function summarizePending(pending: Task[], quickWinMinutes: number): TodaySummary {
  return {
    count: pending.length,
    totalMinutes: sumMinutes(pending),
    quickWinCount: pending.filter((t) => isQuickWin(t, quickWinMinutes)).length,
  };
}
