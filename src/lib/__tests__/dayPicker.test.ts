import { buildDayStrip, buildMonthGrid, canShowMonth, monthKeyOf, monthLabel, shiftMonth } from "../dayPicker";

const TODAY = "2026-10-04"; // a Sunday

describe("buildDayStrip", () => {
  it("starts today and runs for seven days, across a month end", () => {
    const strip = buildDayStrip("2026-10-29");
    expect(strip.map((d) => d.key)).toEqual([
      "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
    ]);
    expect(strip[0]).toMatchObject({ weekday: "Thu", dayOfMonth: 29, isToday: true, isPast: false });
    expect(strip[3]).toMatchObject({ weekday: "Sun", dayOfMonth: 1, isToday: false });
  });
});

describe("month keys", () => {
  it("shifts across year ends in both directions", () => {
    expect(monthKeyOf(TODAY)).toBe("2026-10");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-10", 12)).toBe("2027-10");
  });

  it("names a month", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
  });

  it("allows this month up to twelve months ahead, and nothing earlier", () => {
    expect(canShowMonth("2026-10", TODAY)).toBe(true);
    expect(canShowMonth("2027-10", TODAY)).toBe(true);
    expect(canShowMonth("2026-09", TODAY)).toBe(false);
    expect(canShowMonth("2027-11", TODAY)).toBe(false);
  });
});

describe("buildMonthGrid", () => {
  it("lays October 2026 out Monday-first, padded to whole weeks", () => {
    const grid = buildMonthGrid("2026-10", TODAY);
    expect(grid).toHaveLength(5);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    // 1 October 2026 is a Thursday: three blanks, then the 1st in the fourth column.
    expect(grid[0].slice(0, 3)).toEqual([null, null, null]);
    expect(grid[0][3]).toMatchObject({ key: "2026-10-01", weekday: "Thu", isPast: true });
    expect(grid[0][6]).toMatchObject({ key: "2026-10-04", isToday: true, isPast: false });
    expect(grid[4][5]).toMatchObject({ key: "2026-10-31" });
    expect(grid[4][6]).toBeNull();
  });

  it("handles February in a leap year and a month that starts on a Monday", () => {
    const leap = buildMonthGrid("2028-02", TODAY).flat().filter(Boolean);
    expect(leap).toHaveLength(29);
    const june = buildMonthGrid("2026-06", TODAY); // 1 June 2026 is a Monday
    expect(june[0][0]).toMatchObject({ key: "2026-06-01" });
  });

  it("needs six rows when a 31-day month starts late in the week", () => {
    expect(buildMonthGrid("2026-08", TODAY)).toHaveLength(6); // 1 August 2026 is a Saturday
  });
});
