import {
  groupUpcomingByDay,
  isPendingToday,
  isQuickWin,
  isUpcoming,
  selectSomedayTasks,
  selectTodayTasks,
  selectUpcomingTasks,
} from "../todayTasks";
import { makeTask } from "../testing/makeTask";

const TODAY = "2026-09-28";

describe("isQuickWin", () => {
  it("counts short tasks up to the limit, and never a fixed-time Focus task", () => {
    expect(isQuickWin(makeTask({ estimated_minutes: 5, scheduled_time: null }), 5)).toBe(true);
    expect(isQuickWin(makeTask({ estimated_minutes: 6, scheduled_time: null }), 5)).toBe(false);
    expect(isQuickWin(makeTask({ estimated_minutes: 2, scheduled_time: "09:00" }), 5)).toBe(false);
  });
});

describe("isPendingToday", () => {
  it("includes undated, due-today and overdue pending tasks", () => {
    expect(isPendingToday(makeTask({ due_date: null }), TODAY)).toBe(true);
    expect(isPendingToday(makeTask({ due_date: TODAY }), TODAY)).toBe(true);
    expect(isPendingToday(makeTask({ due_date: "2026-09-20" }), TODAY)).toBe(true);
  });

  it("shows a task with a later deadline, since it can be done any day before it", () => {
    expect(isPendingToday(makeTask({ due_date: "2026-10-04", due_kind: "by" }), TODAY)).toBe(true);
  });

  it("hides tasks set for an exact later day, and completed and parked tasks", () => {
    expect(isPendingToday(makeTask({ due_date: "2026-09-29" }), TODAY)).toBe(false);
    expect(isPendingToday(makeTask({ due_date: "2026-09-29", due_kind: "on" }), TODAY)).toBe(false);
    expect(isPendingToday(makeTask({ due_date: "2026-10-04", due_kind: "by", status: "done" }), TODAY)).toBe(false);
    expect(isPendingToday(makeTask({ status: "done" }), TODAY)).toBe(false);
    expect(isPendingToday(makeTask({ status: "someday" }), TODAY)).toBe(false);
  });
});

describe("selectTodayTasks", () => {
  it("orders pending by timing and keeps done tasks separate", () => {
    const tasks = [
      makeTask({ id: "after", timing: "after_work" }),
      makeTask({ id: "tomorrow", due_date: "2026-09-29" }),
      makeTask({ id: "done", status: "done" }),
      makeTask({ id: "anytime", timing: "anytime" }),
      makeTask({ id: "before", timing: "before_work" }),
    ];

    const { pending, done } = selectTodayTasks(tasks, TODAY);

    expect(pending.map((t) => t.id)).toEqual(["before", "anytime", "after"]);
    expect(done.map((t) => t.id)).toEqual(["done"]);
  });
});

describe("selectSomedayTasks", () => {
  it("returns only parked tasks", () => {
    const tasks = [makeTask({ id: "parked", status: "someday" }), makeTask({ id: "pending" }), makeTask({ id: "done", status: "done" })];

    expect(selectSomedayTasks(tasks).map((t) => t.id)).toEqual(["parked"]);
  });
});

describe("selectUpcomingTasks", () => {
  const tasks = [
    makeTask({ id: "thu-after", due_date: "2026-10-01", due_kind: "on", timing: "after_work" }),
    makeTask({ id: "tomorrow", due_date: "2026-09-29" }),
    makeTask({ id: "thu-before", due_date: "2026-10-01", due_kind: "on", timing: "before_work" }),
    makeTask({ id: "today", due_date: TODAY, due_kind: "on" }),
    makeTask({ id: "overdue", due_date: "2026-09-20", due_kind: "on" }),
    makeTask({ id: "undated" }),
    makeTask({ id: "deadline", due_date: "2026-10-04", due_kind: "by" }),
    makeTask({ id: "done-later", due_date: "2026-10-01", due_kind: "on", status: "done" }),
    makeTask({ id: "parked", status: "someday" }),
  ];

  it("keeps only pending tasks set for an exact later day, nearest day first", () => {
    expect(selectUpcomingTasks(tasks, TODAY).map((t) => t.id)).toEqual(["tomorrow", "thu-before", "thu-after"]);
  });

  it("never overlaps with Today: a pending task is in exactly one of the two", () => {
    for (const task of tasks.filter((t) => t.status === "pending")) {
      expect(isUpcoming(task, TODAY)).toBe(!isPendingToday(task, TODAY));
    }
  });

  it("moves a task out of Upcoming once its day comes", () => {
    expect(selectUpcomingTasks(tasks, "2026-10-01").map((t) => t.id)).toEqual([]);
  });

  it("groups the tasks under their day", () => {
    expect(
      groupUpcomingByDay(selectUpcomingTasks(tasks, TODAY)).map((day) => [day.dateKey, day.tasks.map((t) => t.id)])
    ).toEqual([
      ["2026-09-29", ["tomorrow"]],
      ["2026-10-01", ["thu-before", "thu-after"]],
    ]);
    expect(groupUpcomingByDay([])).toEqual([]);
  });
});
