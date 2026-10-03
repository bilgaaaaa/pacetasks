import {
  addDays,
  daysBetween,
  isValidDateKey,
  isValidTimeOfDay,
  nextWeekendDay,
  toLocalDateKey,
  weekdayIndex,
} from "../dates";

describe("toLocalDateKey", () => {
  it("uses the device's local day, not UTC (tests run in Europe/Rome)", () => {
    expect(toLocalDateKey(new Date("2026-09-28T22:30:00Z"))).toBe("2026-09-29");
  });

  it("uses the phone's time zone when one is given", () => {
    const instant = new Date("2026-09-28T22:30:00Z");
    expect(toLocalDateKey(instant, "Europe/Rome")).toBe("2026-09-29");
    expect(toLocalDateKey(instant, "Europe/Istanbul")).toBe("2026-09-29");
    expect(toLocalDateKey(instant, "America/New_York")).toBe("2026-09-28");
  });
});

describe("isValidDateKey", () => {
  it.each(["2026-09-28", "2028-02-29"])("accepts %s", (value) => {
    expect(isValidDateKey(value)).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-9-28", "tomorrow", ""])("rejects %s", (value) => {
    expect(isValidDateKey(value)).toBe(false);
  });
});

describe("isValidTimeOfDay", () => {
  it.each(["00:00", "09:30", "23:59"])("accepts %s", (value) => {
    expect(isValidTimeOfDay(value)).toBe(true);
  });

  it.each(["24:00", "9:30", "09:60", "noon"])("rejects %s", (value) => {
    expect(isValidTimeOfDay(value)).toBe(false);
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month, year and the Oct 25 2026 DST change as whole days", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days in either direction", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-10-26", "2026-10-24")).toBe(-2);
  });
});

describe("weekend helpers", () => {
  it("gives the day of the week, Sunday first", () => {
    expect(weekdayIndex("2026-09-27")).toBe(0);
    expect(weekdayIndex("2026-09-28")).toBe(1);
  });

  it("finds the first weekend day after a date", () => {
    expect(nextWeekendDay("2026-09-28")).toBe("2026-10-03"); // Monday → Saturday
    expect(nextWeekendDay("2026-10-02")).toBe("2026-10-03"); // Friday → Saturday
    expect(nextWeekendDay("2026-10-03")).toBe("2026-10-04"); // Saturday → Sunday
    expect(nextWeekendDay("2026-10-04")).toBe("2026-10-10"); // Sunday → next Saturday
  });
});
