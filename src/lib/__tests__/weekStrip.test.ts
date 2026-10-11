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
});
