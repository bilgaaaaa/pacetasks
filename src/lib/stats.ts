import { Task } from "./types";

export interface DailyStat {
  date: string; // "YYYY-MM-DD"
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
  estimateAccuracyPercent: number | null; // 100 = estimates matched reality exactly
  dailyBreakdown: DailyStat[];
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD" prefix of an ISO timestamp
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) /
      msPerDay
  );
}

// Turns raw completed tasks into the "beat your own record" numbers shown
// on the stats screen. Pure function — no network/state — so it's easy to
// reason about and unit test independently of the UI.
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

  // Streak: walk backward from today while each preceding day has an entry.
  let currentStreakDays = 0;
  let cursor = todayKey;
  while (byDay.has(cursor)) {
    currentStreakDays += 1;
    const prevDate = new Date(`${cursor}T00:00:00Z`);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    cursor = prevDate.toISOString().slice(0, 10);
  }

  // Best streak: scan all days sorted ascending, count consecutive runs.
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
