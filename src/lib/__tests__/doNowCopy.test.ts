import { emptyMessage, minutesLabel, planSummary } from "../doNowCopy";

describe("doNowCopy", () => {
  it("labels time choices", () => {
    expect(minutesLabel(5)).toBe("5 min");
    expect(minutesLabel(60)).toBe("1 hour");
    expect(minutesLabel(120)).toBe("2 hours");
  });

  it("summarizes the plan", () => {
    expect(planSummary(1, 5, 5)).toBe("1 task · 5 of 5 min");
    expect(planSummary(2, 13, 15)).toBe("2 tasks · 13 of 15 min");
  });

  it("explains an empty result", () => {
    expect(emptyMessage(false, 15, "medium")).toMatch(/Nothing left for today/);
    expect(emptyMessage(true, 5, "low")).toBe("Nothing fits 5 min at low energy. Try more time or more energy.");
    expect(emptyMessage(true, 60, "high")).toBe(
      "What's left today takes longer than 1 hour or has a fixed start time."
    );
  });
});
