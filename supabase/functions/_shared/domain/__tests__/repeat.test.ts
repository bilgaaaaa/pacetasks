import { nextOccurrenceDay, nextRepeatDate } from "../repeat";

// Same cases as supabase/tests/database/task_repeats.test.sql, so the demo and the database agree.
describe("nextRepeatDate", () => {
  it.each([
    ["daily", "2026-11-16", "2026-11-16", "2026-11-17"],
    ["weekdays", "2026-11-16", "2026-11-20", "2026-11-23"],
    ["weekdays", "2026-11-16", "2026-11-21", "2026-11-23"],
    ["weekly", "2026-11-16", "2026-11-16", "2026-11-23"],
    ["weekly", "2026-11-16", "2026-11-18", "2026-11-23"],
    ["weekly", "2026-11-16", "2026-11-22", "2026-11-23"],
    ["monthly", "2026-01-31", "2026-01-31", "2026-02-28"],
    ["monthly", "2026-01-31", "2026-02-28", "2026-03-31"],
    ["monthly", "2026-01-31", "2026-03-05", "2026-03-31"],
    ["monthly", "2026-11-16", "2026-11-16", "2026-12-16"],
    ["monthly", "2026-11-16", "2026-12-20", "2027-01-16"],
  ] as const)("%s from %s after %s is %s", (rule, anchor, after, expected) => {
    expect(nextRepeatDate(rule, anchor, after)).toBe(expected);
  });
});

describe("nextOccurrenceDay", () => {
  it("continues after today when occurrences were missed", () => {
    expect(nextOccurrenceDay({ repeat_rule: "daily", repeat_anchor: "2026-11-10", due_date: "2026-11-10" }, "2026-11-16")).toBe(
      "2026-11-17"
    );
  });

  it("continues after the task's own day when it was done early", () => {
    expect(nextOccurrenceDay({ repeat_rule: "weekly", repeat_anchor: "2026-11-20", due_date: "2026-11-20" }, "2026-11-16")).toBe(
      "2026-11-27"
    );
  });
});
