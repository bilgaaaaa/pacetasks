import { fitsNow, selectDoNowTasks } from "../doNow";
import type { DoNowContext } from "../doNow";
import { makeTask } from "../testing/makeTask";

const TODAY = "2026-09-28";

function makeContext(overrides: Partial<DoNowContext> = {}): DoNowContext {
  return { todayKey: TODAY, availableMinutes: 15, energy: "medium", currentTiming: "anytime", ...overrides };
}

describe("fitsNow", () => {
  it("accepts a pending task that fits the time and energy", () => {
    expect(fitsNow(makeTask({ estimated_minutes: 15, energy_level: "medium" }), makeContext())).toBe(true);
  });

  it("rejects tasks that are too long or need more energy than the user has", () => {
    expect(fitsNow(makeTask({ estimated_minutes: 16 }), makeContext())).toBe(false);
    expect(fitsNow(makeTask({ energy_level: "high" }), makeContext())).toBe(false);
    expect(fitsNow(makeTask({ energy_level: "medium" }), makeContext({ energy: "low" }))).toBe(false);
  });

  it("never hides a task whose energy is unknown", () => {
    expect(fitsNow(makeTask({ energy_level: null }), makeContext({ energy: "low" }))).toBe(true);
  });

  it("rejects tasks that are not on today's list or have a fixed start time", () => {
    expect(fitsNow(makeTask({ status: "done" }), makeContext())).toBe(false);
    expect(fitsNow(makeTask({ status: "someday" }), makeContext())).toBe(false);
    expect(fitsNow(makeTask({ due_date: "2026-09-29" }), makeContext())).toBe(false);
    expect(fitsNow(makeTask({ scheduled_time: "20:00" }), makeContext())).toBe(false);
  });
});

describe("selectDoNowTasks", () => {
  it("fills the available time in rank order and lists what else would fit", () => {
    const tasks = [
      makeTask({ id: "call", estimated_minutes: 10, due_date: TODAY }),
      makeTask({ id: "reply", estimated_minutes: 5 }),
      makeTask({ id: "order", estimated_minutes: 8 }),
    ];

    const { plan, planMinutes, alternatives } = selectDoNowTasks(tasks, makeContext());

    expect(plan.map((t) => t.id)).toEqual(["call", "reply"]);
    expect(planMinutes).toBe(15);
    expect(alternatives.map((t) => t.id)).toEqual(["order"]);
  });

  it("puts overdue before due today before undated", () => {
    const tasks = [
      makeTask({ id: "undated", estimated_minutes: 1 }),
      makeTask({ id: "today", estimated_minutes: 1, due_date: TODAY }),
      makeTask({ id: "overdue", estimated_minutes: 1, due_date: "2026-09-20" }),
    ];

    expect(selectDoNowTasks(tasks, makeContext()).plan.map((t) => t.id)).toEqual(["overdue", "today", "undated"]);
  });

  it("ranks by priority, with no priority counting as medium", () => {
    const tasks = [
      makeTask({ id: "low", estimated_minutes: 1, priority: "low" }),
      makeTask({ id: "none", estimated_minutes: 1, created_at: "2026-09-28T08:00:00.000Z" }),
      makeTask({ id: "medium", estimated_minutes: 1, priority: "medium", created_at: "2026-09-28T09:00:00.000Z" }),
      makeTask({ id: "high", estimated_minutes: 1, priority: "high" }),
    ];

    expect(selectDoNowTasks(tasks, makeContext()).plan.map((t) => t.id)).toEqual(["high", "none", "medium", "low"]);
  });

  it("prefers tasks that suit this part of the day and firm tasks over maybe ones", () => {
    const tasks = [
      makeTask({ id: "maybe", estimated_minutes: 1, flexible: true }),
      makeTask({ id: "after-work", estimated_minutes: 1, timing: "after_work" }),
      makeTask({ id: "before-work", estimated_minutes: 1, timing: "before_work" }),
    ];

    const context = makeContext({ currentTiming: "before_work" });

    expect(selectDoNowTasks(tasks, context).plan.map((t) => t.id)).toEqual(["before-work", "maybe", "after-work"]);
  });

  it("uses high energy on demanding tasks and low energy on easy ones", () => {
    const tasks = [
      makeTask({ id: "easy", estimated_minutes: 5, energy_level: "low" }),
      makeTask({ id: "deep", estimated_minutes: 5, energy_level: "high" }),
      makeTask({ id: "unknown", estimated_minutes: 5, energy_level: null }),
    ];

    expect(selectDoNowTasks(tasks, makeContext({ energy: "high" })).plan.map((t) => t.id)).toEqual([
      "deep",
      "unknown",
      "easy",
    ]);
    expect(selectDoNowTasks(tasks, makeContext({ energy: "low" })).plan.map((t) => t.id)).toEqual(["easy", "unknown"]);
  });

  it("prefers the longer task when everything else is equal, so the time is well used", () => {
    const tasks = [
      makeTask({ id: "short", estimated_minutes: 5 }),
      makeTask({ id: "long", estimated_minutes: 50 }),
    ];

    const { plan, planMinutes } = selectDoNowTasks(tasks, makeContext({ availableMinutes: 60 }));

    expect(plan.map((t) => t.id)).toEqual(["long", "short"]);
    expect(planMinutes).toBe(55);
  });

  it("returns an empty selection when nothing fits", () => {
    const selection = selectDoNowTasks([makeTask({ estimated_minutes: 30 })], makeContext({ availableMinutes: 5 }));

    expect(selection).toEqual({ plan: [], planMinutes: 0, alternatives: [] });
  });
});
