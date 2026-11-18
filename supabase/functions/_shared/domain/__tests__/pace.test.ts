import { selectDoNowTasks } from "../doNow";
import { EMPTY_PACE_MODEL, PACE_POLICY, buildPaceModel, expectedMinutes, hasLearnedPace } from "../pace";
import { buildTaskHistory } from "../taskHistory";
import { makeTask } from "../testing/makeTask";
import type { Task } from "../task";

const TODAY = "2026-11-16";

// A finished, timed run of a task; `day` orders the runs (higher = newer).
function timedRun(title: string, estimated: number, actual: number, day: number): Task {
  const stamp = `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z`;
  return makeTask({
    id: `${title}-${day}`,
    title,
    estimated_minutes: estimated,
    actual_minutes: actual,
    status: "done",
    created_at: stamp,
    completed_at: stamp,
  });
}

describe("buildPaceModel", () => {
  it("learns a task's usual length from its latest timed runs, case-insensitively", () => {
    const model = buildPaceModel([timedRun("Email", 20, 40, 1), timedRun("email ", 20, 30, 2), timedRun("EMAIL", 20, 50, 3)]);
    expect(model.byTitle.get("email")).toEqual({ usualMinutes: 40, timings: 3 });
  });

  it("only uses the most recent runs, so a changed habit shows quickly", () => {
    const old = [1, 2, 3, 4].map((day) => timedRun("Run", 30, 90, day));
    const recent = [5, 6, 7, 8, 9].map((day) => timedRun("Run", 30, 30, day));
    expect(buildPaceModel([...old, ...recent]).byTitle.get("run")?.usualMinutes).toBe(30);
  });

  it("ignores tasks without a logged duration", () => {
    const model = buildPaceModel([makeTask({ status: "done", actual_minutes: null }), makeTask({ status: "pending" })]);
    expect(model.byTitle.size).toBe(0);
    expect(model.ratio).toBeNull();
  });

  it("has no overall pace until enough tasks were timed, then keeps it within limits", () => {
    const few = Array.from({ length: PACE_POLICY.minTimedTasksForRatio - 1 }, (_, i) => timedRun(`T${i}`, 10, 15, i + 1));
    expect(buildPaceModel(few).ratio).toBeNull();

    const slow = Array.from({ length: PACE_POLICY.minTimedTasksForRatio }, (_, i) => timedRun(`T${i}`, 10, 15, i + 1));
    expect(buildPaceModel(slow).ratio).toBeCloseTo(1.5);

    const verySlow = Array.from({ length: PACE_POLICY.minTimedTasksForRatio }, (_, i) => timedRun(`T${i}`, 10, 60, i + 1));
    expect(buildPaceModel(verySlow).ratio).toBe(PACE_POLICY.maxRatio);
  });
});

describe("expectedMinutes", () => {
  const history = [timedRun("Email", 20, 40, 1), timedRun("Email", 20, 44, 2), timedRun("Call mum", 10, 12, 3)];
  const others = Array.from({ length: 4 }, (_, i) => timedRun(`Other ${i}`, 10, 15, i + 4));
  const model = buildPaceModel([...history, ...others]);

  it("uses the task's own usual length once it was timed twice", () => {
    expect(expectedMinutes(makeTask({ title: "email", estimated_minutes: 20 }), model)).toBe(42);
  });

  it("keeps the typed estimate for a task timed only once", () => {
    expect(expectedMinutes(makeTask({ title: "Call mum", estimated_minutes: 12 }), model)).toBe(12);
  });

  it("scales a never-timed task by the overall pace", () => {
    // 156 real minutes over 90 estimated across the seven runs.
    expect(expectedMinutes(makeTask({ title: "New thing", estimated_minutes: 20 }), model)).toBe(35);
  });

  it("falls back to the estimate without any history", () => {
    expect(expectedMinutes(makeTask({ estimated_minutes: 25 }), EMPTY_PACE_MODEL)).toBe(25);
    expect(hasLearnedPace(EMPTY_PACE_MODEL)).toBe(false);
    expect(hasLearnedPace(model)).toBe(true);
  });
});

describe("Fit my time at the learned pace", () => {
  it("leaves out a task that really takes longer than the time available", () => {
    const model = buildPaceModel([timedRun("Email", 10, 25, 1), timedRun("Email", 10, 25, 2)]);
    const email = makeTask({ id: "email", title: "Email", estimated_minutes: 10 });
    const context = { todayKey: TODAY, availableMinutes: 15, energy: "medium" as const, currentTiming: "anytime" as const };

    expect(selectDoNowTasks([email], context).plan).toEqual([email]);
    const atPace = selectDoNowTasks([email], { ...context, paceModel: model });
    expect(atPace.plan).toEqual([]);
  });

  it("counts the plan's minutes at the learned pace", () => {
    const model = buildPaceModel([timedRun("Tidy desk", 15, 8, 1), timedRun("Tidy desk", 15, 8, 2)]);
    const tidy = makeTask({ id: "tidy", title: "Tidy desk", estimated_minutes: 15 });
    const context = { todayKey: TODAY, availableMinutes: 15, energy: "medium" as const, currentTiming: "anytime" as const, paceModel: model };
    expect(selectDoNowTasks([tidy], context).planMinutes).toBe(8);
  });
});

describe("task history usual length", () => {
  it("fills in the median of the latest runs, not just the last one", () => {
    const newestFirst = [timedRun("Gym", 60, 90, 3), timedRun("Gym", 60, 60, 2), timedRun("Gym", 60, 65, 1)];
    const entry = buildTaskHistory(newestFirst).get("gym");
    expect(entry?.lastMinutes).toBe(90);
    expect(entry?.usualMinutes).toBe(65);
    expect(entry?.recentMinutes).toEqual([90, 60, 65]);
  });
});
