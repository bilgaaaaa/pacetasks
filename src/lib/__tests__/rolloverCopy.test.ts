import { destinationLabel, reasonLabel, rolloverSummary, ROLLOVER_DESTINATION_OPTIONS } from "../rolloverCopy";

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

  it("counts the carried-over tasks", () => {
    expect(rolloverSummary(1)).toBe("1 task carried over");
    expect(rolloverSummary(4)).toBe("4 tasks carried over");
  });
});
