import { emptyFilterMessage, greeting, totalsLine } from "../todayCopy";

describe("todayCopy", () => {
  it("greets by the part of the day, with a calm line late at night", () => {
    expect([5, 11].map(greeting)).toEqual(["Good morning", "Good morning"]);
    expect([12, 17].map(greeting)).toEqual(["Good afternoon", "Good afternoon"]);
    expect([18, 21].map(greeting)).toEqual(["Good evening", "Good evening"]);
    expect([22, 23, 0, 4].map(greeting)).toEqual(Array(4).fill("Winding down"));
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
