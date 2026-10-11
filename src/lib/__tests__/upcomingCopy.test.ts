import { upcomingDayCount, upcomingDayHeading, upcomingLink } from "../upcomingCopy";

describe("upcomingCopy", () => {
  it("labels the footer link with the count", () => {
    expect(upcomingLink(3)).toBe("Upcoming · 3");
  });

  it("spells out each day, and names tomorrow", () => {
    expect(upcomingDayHeading("2026-10-13", "2026-10-12")).toBe("Tomorrow · Tue 13 Oct");
    expect(upcomingDayHeading("2026-10-15", "2026-10-12")).toBe("Thu 15 Oct");
  });

  it("counts a day's tasks", () => {
    expect(upcomingDayCount(1)).toBe("1 task");
    expect(upcomingDayCount(2)).toBe("2 tasks");
  });
});
