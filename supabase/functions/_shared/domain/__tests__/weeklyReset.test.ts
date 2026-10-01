import { makeTask } from "../testing/makeTask";
import { countResetReasons, resetOutcome, resetPatch, selectResetItems } from "../weeklyReset";

const TODAY = "2026-09-28"; // a Monday
const RECENT = "2026-09-25T08:00:00.000Z";

describe("selectResetItems", () => {
  it("picks overdue, repeatedly postponed and long-undated tasks, each with its reason", () => {
    const tasks = [
      makeTask({ id: "stale", due_date: null, created_at: "2026-09-10T08:00:00.000Z" }),
      makeTask({ id: "moved", due_date: "2026-09-30", postponed_count: 2, created_at: RECENT }),
      makeTask({ id: "overdue", due_date: "2026-09-26", created_at: RECENT }),
    ];

    expect(selectResetItems(tasks, TODAY).map((item) => [item.task.id, item.reason])).toEqual([
      ["overdue", "overdue"],
      ["moved", "postponed_often"],
      ["stale", "undated_old"],
    ]);
  });

  it("lists a task once, under its most pressing reason, oldest first", () => {
    const tasks = [
      makeTask({ id: "newer", due_date: "2026-09-27", created_at: RECENT }),
      makeTask({ id: "older", due_date: "2026-09-20", postponed_count: 4, created_at: RECENT }),
    ];

    expect(selectResetItems(tasks, TODAY).map((item) => [item.task.id, item.reason])).toEqual([
      ["older", "overdue"],
      ["newer", "overdue"],
    ]);
  });

  it("leaves healthy, finished and parked tasks alone", () => {
    const tasks = [
      makeTask({ id: "fresh", due_date: null, created_at: RECENT }),
      makeTask({ id: "upcoming", due_date: "2026-09-30", postponed_count: 1, created_at: RECENT }),
      makeTask({ id: "done", status: "done", due_date: "2026-09-20" }),
      makeTask({ id: "parked", status: "someday", created_at: "2026-08-01T08:00:00.000Z" }),
    ];

    expect(selectResetItems(tasks, TODAY)).toEqual([]);
  });

  it("measures an undated task's age in the phone's days", () => {
    // 22:30 UTC on the 14th is already the 15th in Rome: 13 days before the 28th, not 14.
    const task = makeTask({ due_date: null, created_at: "2026-09-14T22:30:00.000Z" });

    expect(selectResetItems([task], TODAY, "Europe/Rome")).toEqual([]);
    expect(selectResetItems([task], TODAY, "UTC").map((item) => item.reason)).toEqual(["undated_old"]);
  });
});

describe("countResetReasons", () => {
  it("counts items per reason", () => {
    const items = selectResetItems(
      [
        makeTask({ id: "a", due_date: "2026-09-26", created_at: RECENT }),
        makeTask({ id: "b", due_date: "2026-09-27", created_at: RECENT }),
        makeTask({ id: "c", due_date: null, created_at: "2026-09-01T08:00:00.000Z" }),
      ],
      TODAY
    );

    expect(countResetReasons(items)).toEqual({ overdue: 2, postponed_often: 0, undated_old: 1 });
  });
});

describe("reset decisions", () => {
  const task = makeTask({ due_date: "2026-09-26", due_kind: "on" });

  it("moves or parks the task for a destination", () => {
    expect(resetPatch(task, "tomorrow", TODAY)).toEqual({ due_date: "2026-09-29", due_kind: "on" });
    expect(resetPatch(task, "someday", TODAY)).toEqual({ status: "someday", due_date: null, due_kind: null });
  });

  it("does not patch the task for delete and keep", () => {
    expect(resetPatch(task, "delete", TODAY)).toBeNull();
    expect(resetPatch(task, "keep", TODAY)).toBeNull();
  });

  it("names the outcome of each decision", () => {
    expect(resetOutcome("today")).toBe("scheduled");
    expect(resetOutcome("weekend")).toBe("scheduled");
    expect(resetOutcome("someday")).toBe("parked");
    expect(resetOutcome("delete")).toBe("deleted");
    expect(resetOutcome("keep")).toBe("kept");
  });
});
