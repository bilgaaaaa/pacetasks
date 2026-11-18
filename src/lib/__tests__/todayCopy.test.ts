import { dayEyebrow, dayTitle, emptyFilterMessage, greetingForHour, totalsLine } from "../todayCopy";

describe("todayCopy", () => {
  it("greets by the part of the day, with a calm line late at night", () => {
    expect([5, 11].map(greetingForHour)).toEqual(["Good morning", "Good morning"]);
    expect([12, 17].map(greetingForHour)).toEqual(["Good afternoon", "Good afternoon"]);
    expect([18, 23, 0, 4].map(greetingForHour)).toEqual(Array(4).fill("Good evening"));
  });

  it("keeps the totals as a short secondary line", () => {
    expect(totalsLine(13, 343)).toBe("13 tasks · about 343 min");
    expect(totalsLine(1, 5)).toBe("1 task · about 5 min");
    expect(totalsLine(0, 0)).toBe("Nothing left for today");
  });

  it("explains an empty filter", () => {
    expect(emptyFilterMessage("due")).toBe("Nothing is due today.");
    expect(emptyFilterMessage("quick")).toMatch(/No quick wins/);
  });

  it("titles a day by the greeting on today, otherwise by which day it is", () => {
    expect(dayTitle("2026-10-14", "2026-10-14", 9)).toBe("Good morning");
    expect(dayTitle("2026-10-15", "2026-10-14", 9)).toBe("Tomorrow");
    expect(dayTitle("2026-10-13", "2026-10-14", 9)).toBe("Yesterday");
    expect(dayTitle("2026-10-16", "2026-10-14", 9)).toBe("Friday");
  });

  it("labels the shown day over the title", () => {
    expect(dayEyebrow("2026-10-04")).toBe("SUNDAY · OCTOBER 4");
  });
});
