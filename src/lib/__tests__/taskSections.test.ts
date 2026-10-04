import { makeTask } from "@domain/testing/makeTask";
import { filterTodayTasks, groupTodayTasks, isDueByToday, isQuickWin, placeOfTask, summarizePending } from "../taskSections";

// Already in Today's timing order, as selectTodayTasks returns them.
const pending = [
  makeTask({ id: "q4", title: "Draft Q4 review", estimated_minutes: 25, category: "work", timing: "before_work", scheduled_time: "09:30" }),
  makeTask({ id: "bill", title: "Pay electricity", estimated_minutes: 3, category: "home", timing: "anytime" }),
  makeTask({ id: "marco", title: "Reply to Marco", estimated_minutes: 2, category: "personal", timing: "anytime" }),
  makeTask({ id: "milk", title: "Buy oat milk", estimated_minutes: 10, category: "shopping", timing: "after_work" }),
  makeTask({ id: "misc", title: "Think about holidays", estimated_minutes: 5, category: null, timing: "after_work" }),
];

const TODAY = "2026-10-04";

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

  it("groups by time of day and supports one plain 'All' list", () => {
    expect(ids(groupTodayTasks(pending, "when", 5))).toEqual([
      ["before_work", ["q4"]],
      ["anytime", ["bill", "marco"]],
      ["after_work", ["milk", "misc"]],
    ]);
    const [all] = groupTodayTasks(pending, "all", 5);
    expect(all.key).toBe("all");
    expect(all.tasks).toHaveLength(5);
    expect(all.totalMinutes).toBe(45);
  });

  it("summarizes what is left", () => {
    expect(summarizePending(pending, 5, TODAY)).toEqual({ count: 5, totalMinutes: 45, quickWinCount: 3, dueCount: 0 });
    expect(groupTodayTasks([], "size", 5)).toEqual([]);
  });

  it("treats only dated tasks due today or earlier as due", () => {
    expect(isDueByToday({ due_date: TODAY }, TODAY)).toBe(true);
    expect(isDueByToday({ due_date: "2026-10-01" }, TODAY)).toBe(true); // overdue is still due
    expect(isDueByToday({ due_date: "2026-10-05" }, TODAY)).toBe(false);
    expect(isDueByToday({ due_date: null }, TODAY)).toBe(false);
  });

  it("filters Today by quick wins or due today, keeping order", () => {
    const dated = [
      ...pending,
      makeTask({ id: "tax", title: "Send tax documents", estimated_minutes: 20, due_date: "2026-10-01" }),
      makeTask({ id: "call", title: "Call the bank", estimated_minutes: 4, due_date: TODAY }),
    ];
    const filtered = (filter: Parameters<typeof filterTodayTasks>[1]) =>
      filterTodayTasks(dated, filter, 5, TODAY).map((t) => t.id);
    expect(filtered("all")).toEqual(["q4", "bill", "marco", "milk", "misc", "tax", "call"]);
    expect(filtered("quick")).toEqual(["bill", "marco", "misc", "call"]);
    expect(filtered("due")).toEqual(["tax", "call"]);
    expect(summarizePending(dated, 5, TODAY)).toEqual({ count: 7, totalMinutes: 69, quickWinCount: 4, dueCount: 2 });
  });
});
