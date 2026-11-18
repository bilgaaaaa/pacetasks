import { hourOf, quickTimeChoices, shiftMinutes, shiftTime, suggestedStartTime, withTimePart } from "../timeOptions";

const WORK = { workStartHour: 9, workEndHour: 18 };

describe("shiftTime", () => {
  it("moves by whole minutes and wraps around midnight", () => {
    expect(shiftTime("18:30", 60)).toBe("19:30");
    expect(shiftTime("23:30", 60)).toBe("00:30");
    expect(shiftTime("00:10", -60)).toBe("23:10");
  });

  it("leaves an invalid time alone", () => {
    expect(shiftTime("nope", 60)).toBe("nope");
  });
});

describe("shiftMinutes", () => {
  it("wraps the minutes inside the same hour", () => {
    expect(shiftMinutes("18:55", 5)).toBe("18:00");
    expect(shiftMinutes("18:00", -5)).toBe("18:55");
    expect(shiftMinutes("07:20", 5)).toBe("07:25");
  });
});

describe("suggestedStartTime", () => {
  const at = (hour: number, minute: number) => new Date(2026, 9, 12, hour, minute);

  it("is the next full hour outside work hours", () => {
    expect(suggestedStartTime(at(6, 30), "anytime", WORK)).toBe("07:00");
    expect(suggestedStartTime(at(19, 10), "anytime", WORK)).toBe("20:00");
    expect(suggestedStartTime(at(23, 10), "anytime", WORK)).toBe("00:00");
  });

  it("never lands inside work hours by itself", () => {
    expect(suggestedStartTime(at(9, 35), "anytime", WORK)).toBe("18:00");
    expect(suggestedStartTime(at(8, 30), "anytime", WORK)).toBe("18:00");
  });

  it("puts an after-work task at the end of work or later", () => {
    expect(suggestedStartTime(at(9, 35), "after_work", WORK)).toBe("18:00");
    expect(suggestedStartTime(at(19, 10), "after_work", WORK)).toBe("20:00");
    expect(suggestedStartTime(at(23, 10), "after_work", WORK)).toBe("18:00");
  });

  it("puts a before-work task before work starts", () => {
    expect(suggestedStartTime(at(6, 30), "before_work", WORK)).toBe("07:00");
    expect(suggestedStartTime(at(14, 0), "before_work", WORK)).toBe("08:00");
  });
});

describe("withTimePart", () => {
  it("puts a typed hour or minute into the time", () => {
    expect(withTimePart("10:00", "hour", "18")).toBe("18:00");
    expect(withTimePart("18:00", "minute", "37")).toBe("18:37");
    expect(withTimePart("18:30", "hour", "7")).toBe("07:30");
  });

  it("brings out-of-range numbers to the nearest valid one", () => {
    expect(withTimePart("18:30", "hour", "99")).toBe("23:30");
    expect(withTimePart("18:30", "minute", "75")).toBe("18:59");
  });

  it("is null when nothing usable was typed", () => {
    expect(withTimePart("18:30", "hour", "")).toBeNull();
    expect(withTimePart("nope", "hour", "7")).toBeNull();
  });
});

describe("quickTimeChoices", () => {
  it("starts with an hour from now, then the times around the work day", () => {
    expect(quickTimeChoices(new Date(2026, 9, 12, 8, 32), WORK)).toEqual([
      { label: "In 1 hour", time: "09:35" },
      { label: "Before work", time: "08:00" },
      { label: "12:30", time: "12:30" },
      { label: "After work", time: "18:00" },
      { label: "20:30", time: "20:30" },
    ]);
  });

  it("drops a shortcut that repeats an earlier one", () => {
    const labels = quickTimeChoices(new Date(2026, 9, 12, 17, 0), WORK).map((c) => c.label);
    expect(labels).toEqual(["In 1 hour", "Before work", "12:30", "20:30"]);
  });
});

describe("hourOf", () => {
  it("reads the hour", () => {
    expect(hourOf("18:30")).toBe(18);
  });
});
