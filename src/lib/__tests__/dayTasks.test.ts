import { makeTask } from "@domain/testing/makeTask";
import { plannedDayKey, selectDayTasks } from "../dayTasks";

const TODAY = "2026-10-14";

// Local noon on a day, so the completion's local date is that day in any time zone the tests run in.
const doneOn = (dayKey: string) => new Date(`${dayKey}T12:00:00`).toISOString();

describe("selectDayTasks", () => {
  const tasks = [
    makeTask({ id: "undated" }),
    makeTask({ id: "overdue", due_date: "2026-10-12", due_kind: "on" }),
    makeTask({ id: "thursday", due_date: "2026-10-15", due_kind: "on", timing: "after_work" }),
    makeTask({ id: "thursday-early", due_date: "2026-10-15", due_kind: "on", timing: "before_work" }),
    makeTask({ id: "deadline", due_date: "2026-10-18", due_kind: "by" }),
    makeTask({ id: "done-monday", status: "done", completed_at: doneOn("2026-10-12") }),
    makeTask({ id: "done-today", status: "done", completed_at: doneOn(TODAY) }),
  ];
  const ids = (list: { id: string }[]) => list.map((task) => task.id);

  it("lists today like the Today list, with only today's finished tasks", () => {
    const { pending, done } = selectDayTasks(tasks, TODAY, TODAY);
    expect(ids(pending)).toEqual(["undated", "overdue", "deadline"]);
    expect(ids(done)).toEqual(["done-today"]);
  });

  it("lists what is set for a later day, in timing order", () => {
    expect(ids(selectDayTasks(tasks, "2026-10-15", TODAY).pending)).toEqual(["thursday-early", "thursday"]);
    expect(ids(selectDayTasks(tasks, "2026-10-18", TODAY).pending)).toEqual(["deadline"]);
  });

  it("lists only what was finished on an earlier day", () => {
    const { pending, done } = selectDayTasks(tasks, "2026-10-12", TODAY);
    expect(pending).toEqual([]);
    expect(ids(done)).toEqual(["done-monday"]);
  });
});

describe("plannedDayKey", () => {
  it("plans a later day, and keeps the default on today and earlier days", () => {
    expect(plannedDayKey("2026-10-15", TODAY)).toBe("2026-10-15");
    expect(plannedDayKey(TODAY, TODAY)).toBeNull();
    expect(plannedDayKey("2026-10-12", TODAY)).toBeNull();
  });
});
