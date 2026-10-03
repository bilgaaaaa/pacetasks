import { destinationLabel, reasonLabel, rolloverTitle, ROLLOVER_DESTINATION_OPTIONS } from "../rolloverCopy";

describe("rolloverCopy", () => {
  it("offers every destination with a label", () => {
    expect(ROLLOVER_DESTINATION_OPTIONS.map((o) => o.label)).toEqual(["Today", "Tomorrow", "Weekend", "Someday"]);
    expect(destinationLabel("someday")).toBe("Someday");
  });

  it("explains a proposal only when there is something to say", () => {
    expect(reasonLabel("deadline_passed")).toBe("Deadline passed");
    expect(reasonLabel("fits_today")).toBeNull();
    expect(reasonLabel(null)).toBeNull();
  });

  it("counts the unfinished tasks", () => {
    expect(rolloverTitle(1)).toBe("You left 1 thing unfinished.");
    expect(rolloverTitle(4)).toBe("You left 4 things unfinished.");
  });
});
