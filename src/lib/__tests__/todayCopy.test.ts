import { emptyFilterMessage, greetingForHour, quickWinsMessage, totalsLine } from "../todayCopy";

describe("todayCopy", () => {
  it("greets by the part of the day, and never says good morning at night", () => {
    expect(greetingForHour(5)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good afternoon");
    expect(greetingForHour(18)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
    expect(greetingForHour(0)).toBe("Good evening");
    expect(greetingForHour(4)).toBe("Good evening");
  });

  it("headlines quick wins only when there are some", () => {
    expect(quickWinsMessage(0)).toBeNull();
    expect(quickWinsMessage(1)).toBe("1 quick win available");
    expect(quickWinsMessage(2)).toBe("2 quick wins available");
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
});
