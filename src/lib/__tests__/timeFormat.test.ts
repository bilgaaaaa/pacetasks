import { formatTimeOfDay, parseTimeOfDay } from "../timeFormat";

describe("timeFormat", () => {
  it("shows every time in 24-hour form", () => {
    expect(formatTimeOfDay(18, 30)).toBe("18:30");
    expect(formatTimeOfDay(9)).toBe("09:00");
    expect(formatTimeOfDay(0, 5)).toBe("00:05");
  });

  it("reads a stored time back", () => {
    expect(parseTimeOfDay("18:30")).toEqual({ hour: 18, minute: 30 });
    expect(parseTimeOfDay("nonsense")).toEqual({ hour: 0, minute: 0 });
  });
});
