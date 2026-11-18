import { makeTask } from "../testing/makeTask";
import {
  countResetReasons,
  keepResetTask,
  keptIdsThisWeek,
  parseKeptResetTasks,
  resetOutcome,
  resetPatch,
  selectResetItems,
} from "../weeklyReset";

const TODAY = "2026-09-28"; // a Monday
const RECENT = "2026-09-25T08:00:00.000Z";

describe("selectResetItems", () => {
  it("picks overdue, repeatedly postponed and long-undated tasks, each with its reason", () => {
    const tasks = [
      makeTask({ id: "stale", due_date: null, created_at: "2026-09-10T08:00:00.000Z" }),
      makeTask({ id: "moved", due_date: TODAY, postponed_count: 2, created_at: RECENT }),
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
      makeTask({ id: "just-rescheduled", due_date: "2026-09-30", postponed_count: 5, created_at: RECENT }),
      makeTask({ id: "done", status: "done", due_date: "2026-09-20" }),
      makeTask({ id: "parked", status: "someday", created_at: "2026-08-01T08:00:00.000Z" }),
    ];

    expect(selectResetItems(tasks, TODAY)).toEqual([]);
  });

  it("skips the tasks already kept this week", () => {
    const tasks = [
      makeTask({ id: "kept", due_date: "2026-09-26", created_at: RECENT }),
      makeTask({ id: "open", due_date: "2026-09-27", created_at: RECENT }),
    ];

    expect(selectResetItems(tasks, TODAY, { keptIds: ["kept"] }).map((item) => item.task.id)).toEqual(["open"]);
  });

  it("measures an undated task's age in the phone's days", () => {
    // 22:30 UTC on the 14th is already the 15th in Rome: 13 days before the 28th, not 14.
    const task = makeTask({ due_date: null, created_at: "2026-09-14T22:30:00.000Z" });

    expect(selectResetItems([task], TODAY, { timeZone: "Europe/Rome" })).toEqual([]);
    expect(selectResetItems([task], TODAY, { timeZone: "UTC" }).map((item) => item.reason)).toEqual(["undated_old"]);
  });
});

describe("kept tasks", () => {
  const SUNDAY = "2026-10-04"; // the last day of TODAY's week
  const NEXT_MONDAY = "2026-10-05";

  it("remembers a kept task for the rest of its Monday-to-Sunday week", () => {
    const kept = keepResetTask(null, "a", "2026-09-30");

    expect(kept).toEqual({ weekStart: TODAY, taskIds: ["a"] });
    expect(keptIdsThisWeek(kept, SUNDAY)).toEqual(["a"]);
  });

  it("offers a kept task again once the next week starts", () => {
    const kept = keepResetTask(null, "a", SUNDAY);

    expect(keptIdsThisWeek(kept, NEXT_MONDAY)).toEqual([]);
    expect(keptIdsThisWeek(null, TODAY)).toEqual([]);
  });

  it("adds to this week's tasks, each listed once", () => {
    const kept = keepResetTask(keepResetTask(keepResetTask(null, "a", TODAY), "b", SUNDAY), "a", SUNDAY);

    expect(kept.taskIds).toEqual(["a", "b"]);
  });

  it("drops an earlier week's tasks when one is kept in a new week", () => {
    const lastWeek = keepResetTask(null, "old", SUNDAY);

    expect(keepResetTask(lastWeek, "new", NEXT_MONDAY)).toEqual({ weekStart: NEXT_MONDAY, taskIds: ["new"] });
  });
});

describe("parseKeptResetTasks", () => {
  it("reads back what was stored", () => {
    const kept = keepResetTask(null, "a", TODAY);

    expect(parseKeptResetTasks(JSON.stringify(kept))).toEqual(kept);
  });

  it("treats missing or damaged storage as nothing kept", () => {
    expect(parseKeptResetTasks(null)).toBeNull();
    expect(parseKeptResetTasks("not json")).toBeNull();
    expect(parseKeptResetTasks(JSON.stringify(["a"]))).toBeNull();
    expect(parseKeptResetTasks(JSON.stringify({ weekStart: "this week", taskIds: ["a"] }))).toBeNull();
    expect(parseKeptResetTasks(JSON.stringify({ weekStart: TODAY }))).toBeNull();
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
