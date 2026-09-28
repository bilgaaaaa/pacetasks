import { Task } from "./types";

export interface DailyStat {
  date: string;
  completedCount: number;
  estimatedMinutes: number;
  actualMinutes: number;
}

export interface Stats {
  todayCompleted: number;
  todayActualMinutes: number;
  currentStreakDays: number;
  bestStreakDays: number;
  bestDayCount: number;
  totalCompleted: number;
  estimateAccuracyPercent: number | null;
  dailyBreakdown: DailyStat[];
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) /
      msPerDay
  );
}

export function computeStats(tasks: Task[]): Stats {
  const completed = tasks.filter(
    (t) => t.status === "done" && t.completed_at !== null
  );

  const byDay = new Map<string, DailyStat>();
  for (const task of completed) {
    const key = toDateKey(task.completed_at as string);
    const existing = byDay.get(key) ?? {
      date: key,
      completedCount: 0,
      estimatedMinutes: 0,
      actualMinutes: 0,
    };
    existing.completedCount += 1;
    existing.estimatedMinutes += task.estimated_minutes;
    existing.actualMinutes += task.actual_minutes ?? 0;
    byDay.set(key, existing);
  }

  const dailyBreakdown = Array.from(byDay.values()).sort((a, b) =>
    a.date < b.date ? 1 : -1
  );

  const todayKey = toDateKey(new Date().toISOString());
  const today = byDay.get(todayKey);

  let currentStreakDays = 0;
  let cursor = todayKey;
  while (byDay.has(cursor)) {
    currentStreakDays += 1;
    const prevDate = new Date(`${cursor}T00:00:00Z`);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    cursor = prevDate.toISOString().slice(0, 10);
  }

  const sortedAsc = [...dailyBreakdown].sort((a, b) => (a.date > b.date ? 1 : -1));
  let bestStreakDays = 0;
  let runLength = 0;
  for (let i = 0; i < sortedAsc.length; i++) {
    if (i === 0 || daysBetween(sortedAsc[i].date, sortedAsc[i - 1].date) === 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    bestStreakDays = Math.max(bestStreakDays, runLength);
  }

  const bestDayCount = dailyBreakdown.reduce(
    (max, day) => Math.max(max, day.completedCount),
    0
  );

  const withActuals = completed.filter((t) => t.actual_minutes !== null);
  const estimateAccuracyPercent =
    withActuals.length === 0
      ? null
      : Math.round(
          (withActuals.reduce(
            (sum, t) =>
              sum +
              Math.min(
                1,
                t.estimated_minutes / Math.max(1, t.actual_minutes as number)
              ),
            0
          ) /
            withActuals.length) *
            100
        );

  return {
    todayCompleted: today?.completedCount ?? 0,
    todayActualMinutes: today?.actualMinutes ?? 0,
    currentStreakDays,
    bestStreakDays,
    bestDayCount,
    totalCompleted: completed.length,
    estimateAccuracyPercent,
    dailyBreakdown,
  };
}

export interface HeatmapCell {
  date: string;
  completedCount: number;
  level: number; // 0-4, darker = more tasks completed that day
}

export interface Heatmap {
  weeks: HeatmapCell[][]; // outer: week (oldest first), inner: Mon..Fri
  rangeLabel: string; // e.g. "Jun — Sep"
}

function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// Weekday-only (Mon-Fri) contribution grid for the Stats tab, covering the
// most recent `weekCount` weeks including the current one. Weekends are
// skipped since this app is built around a work schedule.
export function buildWeekdayHeatmap(
  dailyBreakdown: DailyStat[],
  weekCount = 13
): Heatmap {
  const countByDate = new Map(dailyBreakdown.map((d) => [d.date, d.completedCount]));

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisMonday = new Date(today);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);

  const weeks: HeatmapCell[][] = [];
  for (let w = weekCount - 1; w >= 0; w--) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() - w * 7);
    const week: HeatmapCell[] = [];
    for (let d = 0; d < 5; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const key = date.toISOString().slice(0, 10);
      const completedCount = countByDate.get(key) ?? 0;
      week.push({ date: key, completedCount, level: levelFor(completedCount) });
    }
    weeks.push(week);
  }

  const firstDate = new Date(weeks[0][0].date);
  const lastDate = new Date(weeks[weeks.length - 1][4].date);
  const monthFormat = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const rangeLabel = `${monthFormat(firstDate)} — ${monthFormat(lastDate)}`;

  return { weeks, rangeLabel };
}
