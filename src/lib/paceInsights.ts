import { Task } from "./types";

// "My Pace": what the user's own history says about how they work. Pure
// functions only (no React, no network), like stats.ts. Hours and weekdays are
// read in the phone's local time, because "my best hours" are the user's hours.

export const PACE_INSIGHTS_POLICY = {
  minCompletedTasks: 10, // fewer than this is noise, not a pattern
  minTimedTasks: 5, // tasks with a logged duration needed to judge estimates
  windowHours: 3, // width of the "best hours" window
  estimateTolerance: 0.15, // within ±15% the estimates count as close
} as const;

const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

export interface BestWindow {
  startHour: number; // 0–23, local
  endHour: number; // exclusive end, 1–24
  sharePercent: number; // share of all completed tasks finished inside the window
}

export interface BestWeekday {
  weekday: number; // 0 = Sunday … 6 = Saturday, local
  sharePercent: number;
}

export interface EstimateBias {
  direction: "longer" | "shorter" | "close"; // real time compared with the estimates
  percent: number; // how far off, e.g. 40 = tasks take 40% longer
}

export interface PaceInsights {
  completedCount: number;
  ready: boolean; // false until there is enough history to say anything
  bestWindow: BestWindow | null;
  bestWeekday: BestWeekday | null;
  estimateBias: EstimateBias | null; // null until enough tasks have a logged duration
}

// Index of the largest value; the earliest one wins a tie.
function indexOfMax(values: number[]): number {
  return values.reduce((best, value, index) => (value > values[best] ? index : best), 0);
}

function percentOf(part: number, whole: number): number {
  return Math.round((part / whole) * 100);
}

// Reads the patterns in the completed tasks: the hours and the weekday most
// tasks get finished in, and whether tasks run longer or shorter than estimated.
export function computePaceInsights(tasks: Task[]): PaceInsights {
  const completed = tasks.filter((task) => task.status === "done" && task.completed_at !== null);
  const completedCount = completed.length;
  if (completedCount < PACE_INSIGHTS_POLICY.minCompletedTasks) {
    return { completedCount, ready: false, bestWindow: null, bestWeekday: null, estimateBias: null };
  }

  const byHour = new Array<number>(HOURS_PER_DAY).fill(0);
  const byWeekday = new Array<number>(DAYS_PER_WEEK).fill(0);
  for (const task of completed) {
    const completedAt = new Date(task.completed_at as string);
    byHour[completedAt.getHours()] += 1;
    byWeekday[completedAt.getDay()] += 1;
  }

  // Slide a fixed-width window over the day; it never wraps past midnight.
  const { windowHours } = PACE_INSIGHTS_POLICY;
  const windowTotals = Array.from({ length: HOURS_PER_DAY - windowHours + 1 }, (_, startHour) =>
    byHour.slice(startHour, startHour + windowHours).reduce((sum, count) => sum + count, 0)
  );
  const startHour = indexOfMax(windowTotals);
  const weekday = indexOfMax(byWeekday);

  return {
    completedCount,
    ready: true,
    bestWindow: {
      startHour,
      endHour: startHour + windowHours,
      sharePercent: percentOf(windowTotals[startHour], completedCount),
    },
    bestWeekday: { weekday, sharePercent: percentOf(byWeekday[weekday], completedCount) },
    estimateBias: computeEstimateBias(completed),
  };
}

// Compares total real minutes with total estimated minutes, over the tasks whose
// real time was logged (a task completed without a duration says nothing here).
function computeEstimateBias(completed: Task[]): EstimateBias | null {
  const timed = completed.filter((task) => task.actual_minutes !== null);
  if (timed.length < PACE_INSIGHTS_POLICY.minTimedTasks) return null;

  const actual = timed.reduce((sum, task) => sum + (task.actual_minutes as number), 0);
  const estimated = timed.reduce((sum, task) => sum + task.estimated_minutes, 0);
  if (estimated === 0) return null;

  const difference = actual / estimated - 1;
  const percent = Math.round(Math.abs(difference) * 100);
  if (Math.abs(difference) <= PACE_INSIGHTS_POLICY.estimateTolerance) return { direction: "close", percent };
  return { direction: difference > 0 ? "longer" : "shorter", percent };
}
