import { hourOf, quickTimeChoices, shiftMinutes, shiftTime, suggestedStartTime } from "../timeOptions";

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
  it("is the next full hour", () => {
    expect(suggestedStartTime(new Date(2026, 9, 12, 8, 30))).toBe("09:00");
    expect(suggestedStartTime(new Date(2026, 9, 12, 23, 10))).toBe("00:00");
  });
});

describe("quickTimeChoices", () => {
  it("starts with an hour from now, rounded up to five minutes", () => {
    const choices = quickTimeChoices(new Date(2026, 9, 12, 8, 32));
    expect(choices[0]).toEqual({ label: "In 1 hour", time: "09:35" });
    expect(choices.map((c) => c.time)).toEqual(["09:35", "09:00", "12:30", "18:00", "20:30"]);
  });

  it("drops a fixed shortcut that equals 'In 1 hour'", () => {
    const times = quickTimeChoices(new Date(2026, 9, 12, 17, 0)).map((c) => c.time);
    expect(times).toEqual(["18:00", "09:00", "12:30", "20:30"]);
  });
});

describe("hourOf", () => {
  it("reads the hour", () => {
    expect(hourOf("18:30")).toBe(18);
  });
});
