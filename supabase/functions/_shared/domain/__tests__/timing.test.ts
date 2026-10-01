import { timingForHour } from "../timing";

describe("timingForHour", () => {
  it.each([
    [7, "before_work"],
    [9, "anytime"],
    [16, "anytime"],
    [17, "after_work"],
    [22, "after_work"],
  ] as const)("hour %i with 9–17 work hours → %s", (hour, expected) => {
    expect(timingForHour(hour, 9, 17)).toBe(expected);
  });
});
