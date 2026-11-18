import { isValidTaskTime, isWindowOpen, reminderAnchor, taskTimeOf, timeFields, timeSortKey } from "../taskTime";
import type { TaskTime } from "../taskTime";

const NONE = { scheduled_time: null, window_start: null, window_end: null };

describe("taskTimeOf and timeFields", () => {
  it("round-trips every kind through the stored columns", () => {
    const times: TaskTime[] = [
      { kind: "any" },
      { kind: "at", time: "19:30" },
      { kind: "after", start: "20:00" },
      { kind: "before", end: "18:00" },
      { kind: "between", start: "19:00", end: "21:00" },
    ];
    for (const time of times) expect(taskTimeOf(timeFields(time))).toEqual(time);
  });

  it("sets every column, so switching kinds clears the old one", () => {
    expect(timeFields({ kind: "after", start: "20:00" })).toEqual({ ...NONE, window_start: "20:00" });
    expect(timeFields({ kind: "any" })).toEqual(NONE);
  });
});

describe("isValidTaskTime", () => {
  it("needs real times and a window that starts before it ends", () => {
    expect(isValidTaskTime({ kind: "between", start: "19:00", end: "21:00" })).toBe(true);
    expect(isValidTaskTime({ kind: "between", start: "21:00", end: "19:00" })).toBe(false);
    expect(isValidTaskTime({ kind: "at", time: "25:00" })).toBe(false);
  });
});

describe("window helpers", () => {
  it("counts a reminder back from the fixed start or the window's start", () => {
    expect(reminderAnchor({ ...NONE, scheduled_time: "09:00" })).toBe("09:00");
    expect(reminderAnchor({ ...NONE, window_start: "20:00", window_end: "21:00" })).toBe("20:00");
    expect(reminderAnchor({ ...NONE, window_end: "18:00" })).toBeNull();
  });

  it("is open from the start up to, not including, the end", () => {
    const window = { ...NONE, window_start: "19:00", window_end: "21:00" };
    expect(isWindowOpen(window, "18:59")).toBe(false);
    expect(isWindowOpen(window, "19:00")).toBe(true);
    expect(isWindowOpen(window, "21:00")).toBe(false);
    expect(isWindowOpen(NONE, "03:00")).toBe(true);
  });

  it("sorts by the start, then the end of a window", () => {
    expect(timeSortKey({ ...NONE, window_end: "18:00" })).toBe("18:00");
    expect(timeSortKey({ ...NONE, window_start: "20:00", window_end: "21:00" })).toBe("20:00");
  });
});
