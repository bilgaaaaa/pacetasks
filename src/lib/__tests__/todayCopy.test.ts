import { emptyFilterMessage, quickWinsMessage, totalsLine } from "../todayCopy";

describe("todayCopy", () => {
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
