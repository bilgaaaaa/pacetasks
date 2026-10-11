import type { TodayFilter } from "./taskSections";

// UI copy for the Today header and filters. Counts come from summarizePending,
// so every number shown is computed from the real pending list.

// The first hour (0–23) of each part of the day; late night wraps past midnight until morning.
const GREETING_HOURS = { morning: 5, afternoon: 12, evening: 18, lateNight: 22 } as const;

// The Today header's greeting for a local hour. Late night gets a calm line of
// its own, so nobody is wished a good morning at 01:00.
export function greeting(hour: number): string {
  if (hour < GREETING_HOURS.morning || hour >= GREETING_HOURS.lateNight) return "Winding down";
  if (hour < GREETING_HOURS.afternoon) return "Good morning";
  return hour < GREETING_HOURS.evening ? "Good afternoon" : "Good evening";
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

// The grouping panel's heading, and the name VoiceOver reads for the button that opens it.
export const GROUP_PANEL_TITLE = "Group the list";

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
