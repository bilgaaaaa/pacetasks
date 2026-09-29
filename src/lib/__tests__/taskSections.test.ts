import { makeTask } from "@domain/testing/makeTask";
import { groupTodayTasks, isQuickWin, placeOfTask, summarizePending } from "../taskSections";

// Already in Today's timing order, as selectTodayTasks returns them.
const pending = [
  makeTask({ id: "q4", title: "Draft Q4 review", estimated_minutes: 25, category: "work", timing: "before_work", scheduled_time: "09:30" }),
  makeTask({ id: "bill", title: "Pay electricity", estimated_minutes: 3, category: "home", timing: "anytime" }),
  makeTask({ id: "marco", title: "Reply to Marco", estimated_minutes: 2, category: "personal", timing: "anytime" }),
  makeTask({ id: "milk", title: "Buy oat milk", estimated_minutes: 10, category: "shopping", timing: "after_work" }),
  makeTask({ id: "misc", title: "Think about holidays", estimated_minutes: 5, category: null, timing: "after_work" }),
];

const ids = (sections: ReturnType<typeof groupTodayTasks>) =>
  sections.map((s) => [s.key, s.tasks.map((t) => t.id)]);

describe("taskSections", () => {
  it("never counts a fixed-time Focus task as a quick win", () => {
    expect(isQuickWin(makeTask({ estimated_minutes: 2, scheduled_time: "09:00" }), 5)).toBe(false);
    expect(isQuickWin(makeTask({ estimated_minutes: 5, scheduled_time: null }), 5)).toBe(true);
    expect(isQuickWin(makeTask({ estimated_minutes: 6, scheduled_time: null }), 5)).toBe(false);
  });

  it("derives the place from the category", () => {
    expect(placeOfTask({ category: "home" })).toBe("home");
    expect(placeOfTask({ category: "shopping" })).toBe("out");
    expect(placeOfTask({ category: "work" })).toBe("work");
    expect(placeOfTask({ category: "health" })).toBe("anywhere");
    expect(placeOfTask({ category: null })).toBe("anywhere");
  });

  it("groups by size with the chosen threshold, keeping order", () => {
    expect(ids(groupTodayTasks(pending, "size", 5))).toEqual([
      ["quick", ["bill", "marco", "misc"]],
      ["longer", ["q4", "milk"]],
    ]);
    expect(ids(groupTodayTasks(pending, "size", 2))).toEqual([
      ["quick", ["marco"]],
      ["longer", ["q4", "bill", "milk", "misc"]],
    ]);
  });

  it("groups by place and hides empty sections", () => {
    expect(ids(groupTodayTasks(pending, "place", 5))).toEqual([
      ["home", ["bill"]],
      ["out", ["milk"]],
      ["work", ["q4"]],
      ["anywhere", ["marco", "misc"]],
    ]);
  });

  it("groups by category with uncategorized tasks last", () => {
    expect(ids(groupTodayTasks(pending, "category", 5))).toEqual([
      ["work", ["q4"]],
      ["personal", ["marco"]],
      ["shopping", ["milk"]],
      ["home", ["bill"]],
      ["none", ["misc"]],
    ]);
  });

  it("groups by time of day and supports one plain list", () => {
    expect(ids(groupTodayTasks(pending, "when", 5))).toEqual([
      ["before_work", ["q4"]],
      ["anytime", ["bill", "marco"]],
      ["after_work", ["milk", "misc"]],
    ]);
    const [all] = groupTodayTasks(pending, "none", 5);
    expect(all.tasks).toHaveLength(5);
    expect(all.totalMinutes).toBe(45);
  });

  it("summarizes what is left", () => {
    expect(summarizePending(pending, 5)).toEqual({ count: 5, totalMinutes: 45, quickWinCount: 3 });
    expect(groupTodayTasks([], "size", 5)).toEqual([]);
  });
});
