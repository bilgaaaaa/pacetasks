import { computeStats } from "../stats";
import { makeTask } from "@domain/testing/makeTask";

// Tests run in Europe/Rome (see jest.globalSetup.js).
describe("computeStats", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-29T09:00:00+02:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts a task finished just after local midnight toward the local day", () => {
    const tasks = [
      makeTask({ id: "a", status: "done", actual_minutes: 10, completed_at: "2026-09-28T22:30:00Z" }),
    ];
    const stats = computeStats(tasks);
    expect(stats.dailyBreakdown[0].date).toBe("2026-09-29");
    expect(stats.todayCompleted).toBe(1);
    expect(stats.todayActualMinutes).toBe(10);
  });

  it("computes current and best streaks over consecutive local days", () => {
    const done = (id: string, completedAt: string) =>
      makeTask({ id, status: "done", actual_minutes: 5, completed_at: completedAt });
    const stats = computeStats([
      done("1", "2026-09-29T07:00:00Z"),
      done("2", "2026-09-28T07:00:00Z"),
      done("3", "2026-09-27T07:00:00Z"),
      done("4", "2026-09-20T07:00:00Z"),
    ]);
    expect(stats.currentStreakDays).toBe(3);
    expect(stats.bestStreakDays).toBe(3);
    expect(stats.totalCompleted).toBe(4);
  });

  it("ignores completions without real minutes in estimate accuracy", () => {
    const stats = computeStats([
      makeTask({ id: "1", status: "done", estimated_minutes: 10, actual_minutes: 20, completed_at: "2026-09-29T07:00:00Z" }),
      makeTask({ id: "2", status: "done", estimated_minutes: 10, actual_minutes: null, completed_at: "2026-09-29T07:00:00Z" }),
    ]);
    expect(stats.estimateAccuracyPercent).toBe(50);
  });
});
