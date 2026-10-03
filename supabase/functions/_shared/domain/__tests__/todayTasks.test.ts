import { isPendingToday, selectSomedayTasks, selectTodayTasks } from "../todayTasks";
import { makeTask } from "../testing/makeTask";

const TODAY = "2026-09-28";

describe("isPendingToday", () => {
  it("includes undated, due-today and overdue pending tasks", () => {
    expect(isPendingToday(makeTask({ due_date: null }), TODAY)).toBe(true);
    expect(isPendingToday(makeTask({ due_date: TODAY }), TODAY)).toBe(true);
    expect(isPendingToday(makeTask({ due_date: "2026-09-20" }), TODAY)).toBe(true);
  });

  it("hides future-dated, completed and parked tasks", () => {
    expect(isPendingToday(makeTask({ due_date: "2026-09-29" }), TODAY)).toBe(false);
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
