import { formatDueLabel } from "../dueLabel";

const MONDAY = "2026-09-28";

describe("formatDueLabel", () => {
  it.each([
    ["2026-09-28", null, "Today"],
    ["2026-09-29", "on", "Tomorrow"],
    ["2026-10-02", "on", "Fri"],
    ["2026-10-04", null, "Sun"],
    ["2026-10-05", "on", "5 Oct"],
    ["2026-09-25", "on", "Overdue"],
    ["2026-10-02", "by", "by Fri"],
    ["2026-09-29", "by", "by tomorrow"],
    ["2026-09-28", "by", "by today"],
    ["2026-11-15", "by", "by 15 Nov"],
  ] as const)("%s (%s) → %s", (dueDate, dueKind, expected) => {
    expect(formatDueLabel(dueDate, dueKind, MONDAY)).toBe(expected);
  });
});
