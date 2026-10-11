import type { TodayFilter } from "./taskSections";

// UI copy for the Today header and filters. Counts come from summarizePending,
// so every number shown is computed from the real pending list.

// The headline under "Today": what can be knocked out fast. Null when there
// is nothing quick, so the header shows only the secondary totals.
export function quickWinsMessage(quickWinCount: number): string | null {
  if (quickWinCount <= 0) return null;
  return quickWinCount === 1 ? "1 quick win available" : `${quickWinCount} quick wins available`;
}

// Hours at which the greeting changes. The night (before 5) stays "Good evening":
// someone still up at 1 am is ending their day, not starting it.
const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 18;

// The greeting above Today, from the phone's local hour (0-23).
export function greetingForHour(hour: number): string {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) return "Good morning";
  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) return "Good afternoon";
  return "Good evening";
}

// The secondary totals line: "13 tasks · about 343 min".
export function totalsLine(count: number, totalMinutes: number): string {
  if (count === 0) return "Nothing left for today";
  const tasks = count === 1 ? "1 task" : `${count} tasks`;
  return `${tasks} · about ${totalMinutes} min`;
}

export const TODAY_FILTER_LABELS: Record<TodayFilter, string> = {
  all: "All",
  quick: "Quick wins",
  due: "Due today",
};

// Shown in place of the list when a filter leaves nothing.
export function emptyFilterMessage(filter: TodayFilter): string {
  switch (filter) {
    case "quick":
      return "No quick wins right now. Everything left takes a bit longer.";
    case "due":
      return "Nothing is due today.";
    case "all":
      return "Tap “Add a task” below the moment something pops into your head.";
  }
}
