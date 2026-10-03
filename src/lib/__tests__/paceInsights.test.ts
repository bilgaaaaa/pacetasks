import { makeTask } from "@domain/testing/makeTask";
import { computePaceInsights } from "../paceInsights";
import { paceInsightLines } from "../paceInsightsCopy";

// Tests run in Europe/Rome (UTC+2 in September), so 07:30Z is 09:30 local.
function doneAt(isoUtc: string, estimated = 10, actual: number | null = 10) {
  return makeTask({
    id: isoUtc,
    status: "done",
    completed_at: isoUtc,
    estimated_minutes: estimated,
    actual_minutes: actual,
  });
}

describe("computePaceInsights", () => {
  it("waits for enough history before saying anything", () => {
    const insights = computePaceInsights([doneAt("2026-09-22T07:30:00Z"), makeTask({ id: "pending" })]);

    expect(insights).toEqual({ completedCount: 1, ready: false, bestWindow: null, bestWeekday: null, estimateBias: null });
    expect(paceInsightLines(insights)).toEqual(["Complete 9 more tasks and Pace will start showing how you work."]);
  });

  it("finds the best hours and weekday in local time", () => {
    const tasks = [
      // Tuesday 22 Sep, 09:30–11:30 local: 7 tasks
      ...["07:30", "07:45", "08:10", "08:40", "09:05", "09:20", "09:30"].map((t) => doneAt(`2026-09-22T${t}:00Z`)),
      // Wednesday 23 Sep, 19:00 local: 3 tasks
      ...["17:00", "17:10", "17:20"].map((t) => doneAt(`2026-09-23T${t}:00Z`)),
    ];

    const insights = computePaceInsights(tasks);

    expect(insights.bestWindow).toEqual({ startHour: 9, endHour: 12, sharePercent: 70 });
    expect(insights.bestWeekday).toEqual({ weekday: 2, sharePercent: 70 });
    expect(paceInsightLines(insights).slice(0, 2)).toEqual([
      "You finish most tasks between 09:00 and 12:00 (70% of them).",
      "Tuesday is your strongest day.",
    ]);
  });

  it.each([
    [14, "longer", 40, "Tasks take you about 40% longer than you estimate."],
    [7, "shorter", 30, "You finish about 30% faster than you estimate."],
    [11, "close", 10, "Your time estimates are close to reality."],
  ] as const)("compares real time with estimates (actual %i for 10 estimated)", (actual, direction, percent, line) => {
    const tasks = Array.from({ length: 10 }, (_, i) => doneAt(`2026-09-22T07:${10 + i}:00Z`, 10, actual));

    const insights = computePaceInsights(tasks);

    expect(insights.estimateBias).toEqual({ direction, percent });
    expect(paceInsightLines(insights)[2]).toBe(line);
  });

  it("says nothing about estimates until enough tasks have a logged duration", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => doneAt(`2026-09-22T07:${10 + i}:00Z`, 10, i < 4 ? 20 : null));

    const insights = computePaceInsights(tasks);

    expect(insights.estimateBias).toBeNull();
    expect(paceInsightLines(insights)).toHaveLength(2);
  });
});
