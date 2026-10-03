import { makeTask } from "@domain/testing/makeTask";
import { actionLabel, introLines, itemReason, progressLabel, summaryLine } from "../weeklyResetCopy";

const TODAY = "2026-09-28";

describe("weeklyResetCopy", () => {
  it("lists only the kinds of task that were found", () => {
    expect(introLines({ overdue: 7, postponed_often: 1, undated_old: 0 })).toEqual([
      "7 overdue tasks",
      "1 task you keep postponing",
    ]);
    expect(introLines({ overdue: 0, postponed_often: 0, undated_old: 3 })).toEqual([
      "3 tasks sitting without a date",
    ]);
  });

  it("says why a task is in the reset", () => {
    expect(itemReason({ task: makeTask({ due_date: "2026-09-27" }), reason: "overdue" }, TODAY)).toBe("1 day overdue");
    expect(itemReason({ task: makeTask({ due_date: "2026-09-20" }), reason: "overdue" }, TODAY)).toBe(
      "8 days overdue"
    );
    expect(itemReason({ task: makeTask({ postponed_count: 3 }), reason: "postponed_often" }, TODAY)).toBe(
      "Moved 3 times"
    );
    expect(
      itemReason({ task: makeTask({ created_at: "2026-09-05T08:00:00.000Z" }), reason: "undated_old" }, TODAY)
    ).toBe("No date for 3 weeks");
  });

  it("labels actions and progress", () => {
    expect(actionLabel("weekend")).toBe("Weekend");
    expect(actionLabel("delete")).toBe("Delete");
    expect(actionLabel("keep")).toBe("Keep as is");
    expect(progressLabel(2, 12)).toBe("3 of 12");
  });

  it("summarizes what the run did, leaving out outcomes with none", () => {
    expect(summaryLine({ scheduled: 4, parked: 2, deleted: 1, kept: 0 })).toBe(
      "4 scheduled · 2 moved to Someday · 1 deleted"
    );
    expect(summaryLine({ scheduled: 0, parked: 0, deleted: 0, kept: 0 })).toBe("");
  });
});
