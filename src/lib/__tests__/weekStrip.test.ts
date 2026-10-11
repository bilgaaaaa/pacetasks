import { makeTask } from "@domain/testing/makeTask";
import { buildWeek } from "../weekStrip";

describe("buildWeek", () => {
  it("returns Monday to Sunday around today, across a month end", () => {
    const week = buildWeek("2026-10-01", []); // a Thursday
    expect(week.map((d) => `${d.weekday} ${d.dayOfMonth}`)).toEqual([
      "Mon 28", "Tue 29", "Wed 30", "Thu 1", "Fri 2", "Sat 3", "Sun 4",
    ]);
    expect(week.filter((d) => d.isToday).map((d) => d.key)).toEqual(["2026-10-01"]);
  });

  it("starts on today on a Monday and ends on today on a Sunday", () => {
    expect(buildWeek("2026-10-05", [])[0]).toMatchObject({ key: "2026-10-05", isToday: true });
    expect(buildWeek("2026-10-04", [])[6]).toMatchObject({ key: "2026-10-04", weekday: "Sun", isToday: true });
  });

  it("counts only pending tasks due on each exact day", () => {
    const week = buildWeek("2026-10-05", [
      makeTask({ due_date: "2026-10-06", status: "pending" }),
      makeTask({ due_date: "2026-10-06", status: "pending" }),
      makeTask({ due_date: "2026-10-06", status: "done" }),
      makeTask({ due_date: null, status: "pending" }),
      makeTask({ due_date: "2026-10-20", status: "pending" }),
    ]);
    expect(week.map((d) => d.dueCount)).toEqual([0, 2, 0, 0, 0, 0, 0]);
  });

  it("marks a later day only for tasks waiting in Upcoming, not for deadlines already on Today", () => {
    const week = buildWeek("2026-10-05", [
      makeTask({ due_date: "2026-10-07", due_kind: "on" }),
      makeTask({ due_date: "2026-10-08", due_kind: "by" }),
      makeTask({ due_date: "2026-10-05", due_kind: "by" }),
      makeTask({ due_date: "2026-10-05", due_kind: "on" }),
    ]);
    expect(week.map((d) => d.dueCount)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    // Only Wednesday has something to show; today's own tasks are on Today, not in Upcoming.
    expect(week.map((d) => d.opensUpcoming)).toEqual([false, false, true, false, false, false, false]);
  });
});
